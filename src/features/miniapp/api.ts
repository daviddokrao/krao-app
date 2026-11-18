import {KRAO_INDEXER_URL} from '#/env'
import {IndexerError, indexerFetch} from '#/features/community/api'
import {type MiniAppView} from './logic'
import {type InspectResult, type SimulateResult} from './preview'

/*
 * The Mini App registry and the transaction simulation of Krao's indexer.
 * The registry reads are public; the simulation and the admin methods carry
 * a service auth token (aud = the indexer's DID, scoped to the method).
 */

export const GET_APP = 'net.krao.miniapp.getApp'
export const LIST_APPROVED = 'net.krao.miniapp.listApproved'
export const ADMIN_LIST_PENDING = 'net.krao.miniapp.admin.listPending'
export const ADMIN_APPROVE = 'net.krao.miniapp.admin.approve'
export const ADMIN_REVOKE = 'net.krao.miniapp.admin.revoke'
export const SIMULATE = 'net.krao.wallet.simulate'
export const INSPECT_SIGNATURE = 'net.krao.wallet.inspectSignature'

export type AppPage = {apps: MiniAppView[]; cursor?: string}

export async function getAppRequest(uri: string): Promise<MiniAppView> {
  const {app} = await indexerFetch<{app: MiniAppView}>(GET_APP, {
    params: {uri},
  })
  return app
}

export function listApprovedRequest(
  limit: number,
  cursor?: string,
): Promise<AppPage> {
  return indexerFetch<AppPage>(LIST_APPROVED, {params: {limit, cursor}})
}

export function listPendingRequest(
  token: string,
  cursor?: string,
): Promise<AppPage> {
  return indexerFetch<AppPage>(ADMIN_LIST_PENDING, {
    params: {limit: 25, cursor},
    token,
  })
}

/** A procedure of the indexer with a JSON body and a service auth token */
export async function indexerPost<T>(
  method: string,
  body: unknown,
  token: string,
): Promise<T> {
  const res = await fetch(new URL(`/xrpc/${method}`, KRAO_INDEXER_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const {error, message} = data as {error?: string; message?: string}
    throw new IndexerError(error, message ?? `HTTP ${res.status}`, res.status)
  }
  return data as T
}

export function approveRequest(token: string, app: {uri: string; cid: string}) {
  return indexerPost<unknown>(ADMIN_APPROVE, app, token)
}

export function revokeRequest(
  token: string,
  app: {uri: string; reason?: string},
) {
  return indexerPost<unknown>(ADMIN_REVOKE, app, token)
}

export type SimulateInput = {
  chain: string
  from: string
  to: string
  data?: string
  value?: string
  origin?: string
}

export function simulateRequest(
  token: string,
  input: SimulateInput,
): Promise<SimulateResult> {
  return indexerPost<SimulateResult>(SIMULATE, input, token)
}

export type InspectInput = {
  chain: string
  from: string
  method: 'personal_sign' | 'eth_signTypedData_v4'
  payload: string
  origin?: string
}

export function inspectSignatureRequest(
  token: string,
  input: InspectInput,
): Promise<InspectResult> {
  return indexerPost<InspectResult>(INSPECT_SIGNATURE, input, token)
}
