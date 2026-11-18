import {KRAO_INDEXER_URL} from '#/env'

/*
 * Calls to the community and poll methods of Krao's indexer. Reads are plain
 * GETs; a service-auth token (aud = the indexer's DID) is sent when there is
 * one, so the response can include the viewer's own state.
 */

export class IndexerError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function indexerFetch<T>(
  method: string,
  {
    params,
    token,
  }: {
    params?: Record<string, string | string[] | number | undefined>
    token?: string
  } = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, KRAO_INDEXER_URL)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue
    for (const item of [v].flat()) url.searchParams.append(k, String(item))
  }
  const res = await fetch(url.toString(), {
    headers: token ? {authorization: `Bearer ${token}`} : {},
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const {error, message} = data as {error?: string; message?: string}
    throw new IndexerError(error, message ?? `HTTP ${res.status}`, res.status)
  }
  return data as T
}
