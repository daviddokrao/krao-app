import {useMutation, useQueryClient} from '@tanstack/react-query'

import {createQueryKey} from '#/state/queries/util'
import {useChatClient, useSession} from '#/state/session'
import {KRAO_GATE_DID, KRAO_GATE_URL} from '#/env'
import {net} from '#/lexicons'
import {rewardsFetch} from '../referral/api'
import {useRewardsAuth, useRewardsQuery} from '../referral/queries'
import {serviceFetch} from './api'
import {type ConsentItem} from './consent'
import {markPhoneVerified} from './events'

export type PhoneStatus = {
  verified: boolean
  /** Whether codes can be sent (an SMS provider is set up) */
  available?: boolean
  verifiedAt?: string
  maskedPhone?: string
}

const phoneStatusKey = (did: string) => createQueryKey('phone-status', {did})

/** Whether the viewer has a verified phone number */
export function usePhoneStatusQuery() {
  return useRewardsQuery<PhoneStatus>(
    'net.krao.phone.getStatus',
    'phone-status',
  )
}

/** Sends a code by SMS; resolves to when it stops working */
export function useRequestPhoneCodeMutation() {
  const getToken = useRewardsAuth()
  return useMutation({
    mutationFn: async (phone: string) => {
      const method = 'net.krao.phone.requestCode'
      return rewardsFetch<{expiresAt: string}>(method, {
        body: {phone},
        token: await getToken(method),
      })
    },
  })
}

export function useVerifyPhoneCodeMutation() {
  const getToken = useRewardsAuth()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation({
    mutationFn: async ({phone, code}: {phone: string; code: string}) => {
      const method = 'net.krao.phone.verifyCode'
      return rewardsFetch<PhoneStatus>(method, {
        body: {phone, code},
        token: await getToken(method),
      })
    },
    onSuccess: status => {
      markPhoneVerified()
      if (currentAccount) {
        queryClient.setQueryData(phoneStatusKey(currentAccount.did), status)
        // A verified number can make the "real person" badge available
        void queryClient.invalidateQueries({
          queryKey: createQueryKey('badge-visibility', {
            did: currentAccount.did,
          }),
        })
        void queryClient.invalidateQueries({
          queryKey: createQueryKey('human-badge', {did: currentAccount.did}),
        })
      }
    },
  })
}

export type ConsentRecord = {
  version: string
  items: string[]
  createdAt: string
}

const consentKey = (did: string) => createQueryKey('consent', {did})

/** The consent records of the viewer's account */
export function useConsentQuery() {
  return useRewardsQuery<{consents: ConsentRecord[]}>(
    'net.krao.account.getConsent',
    'consent',
  )
}

/** Records the consent given at sign-up, or later in ConsentGate */
export function useRecordConsentMutation() {
  const getToken = useRewardsAuth()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation({
    mutationFn: async ({
      version,
      items,
    }: {
      version: string
      items: ConsentItem[]
    }) => {
      const method = 'net.krao.account.recordConsent'
      return rewardsFetch(method, {
        body: {version, items},
        token: await getToken(method),
      })
    },
    onSuccess: async () => {
      if (currentAccount) {
        await queryClient.invalidateQueries({
          queryKey: consentKey(currentAccount.did),
        })
      }
    },
  })
}

type ExportPart = {
  service: string
  did: string
  exportedAt: string
  data: unknown
}

export type KraoDataExport = {
  did: string
  exportedAt: string
  services: Record<string, ExportPart | {error: string}>
}

/**
 * Everything Krao services hold about the viewer: asks the rewards service,
 * the indexer (as the gate service) and the chat service, each with a token
 * addressed to it, and merges the answers. A service that fails is listed
 * with its error, so one outage does not stop the download.
 */
export function useExportKraoDataMutation() {
  const {currentAccount} = useSession()
  const getRewardsToken = useRewardsAuth()
  const getGateToken = useGateAuth()
  const chatClient = useChatClient()
  return useMutation({
    mutationFn: async (): Promise<KraoDataExport> => {
      if (!currentAccount) throw new Error('Not signed in')
      const method = net.krao.account.exportData.$lxm
      const parts: [string, () => Promise<ExportPart>][] = [
        [
          'rewards',
          async () =>
            rewardsFetch<ExportPart>(method, {
              token: await getRewardsToken(method),
            }),
        ],
        [
          'indexer',
          async () =>
            serviceFetch<ExportPart>(KRAO_GATE_URL, method, {
              token: await getGateToken(method),
            }),
        ],
        ['chat', async () => chatClient.call(net.krao.account.exportData)],
      ]
      const results = await Promise.allSettled(parts.map(([, run]) => run()))
      const services: KraoDataExport['services'] = {}
      let ok = 0
      results.forEach((r, i) => {
        const name = parts[i][0]
        if (r.status === 'fulfilled') {
          ok++
          services[name] = r.value
        } else {
          services[name] = {
            error: r.reason instanceof Error ? r.reason.message : 'Failed',
          }
        }
      })
      if (!ok) throw new Error('No Krao service answered')
      return {
        did: currentAccount.did,
        exportedAt: new Date().toISOString(),
        services,
      }
    },
  })
}

/** A token from the viewer's PDS addressed to the gate service (the indexer) */
export function useGateAuth() {
  const getToken = useRewardsAuth()
  return async (lxm: string) => getToken(lxm, KRAO_GATE_DID)
}
