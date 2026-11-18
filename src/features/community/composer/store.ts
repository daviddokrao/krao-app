import {useSyncExternalStore} from 'react'

import {type PollDraft} from '#/features/poll/logic'

/*
 * What the composer adds for Krao: a community to post into (optionally with
 * member-only content) and a poll. The composer is a single instance, so this
 * is a small module store: the pills and dialogs read and write it, and the
 * composer reads it when publishing (see useKraoComposer).
 */

export type ComposerCommunity = {uri: string; name: string; slug: string}

export type KraoComposerState = {
  community?: ComposerCommunity
  /** Text only members of the community can read (a member-only gate) */
  memberOnly: boolean
  memberOnlyText: string
  poll?: PollDraft
  /** A Mini App the post carries as its embed (net.krao.embed.miniapp) */
  miniApp?: {uri: string; cid: string; name: string}
}

const initial: KraoComposerState = {memberOnly: false, memberOnlyText: ''}

let state: KraoComposerState = initial
let preset: ComposerCommunity | undefined
const listeners = new Set<() => void>()

function set(next: KraoComposerState) {
  state = next
  for (const listener of listeners) listener()
}

export const kraoComposer = {
  get: () => state,
  update: (patch: Partial<KraoComposerState>) => set({...state, ...patch}),
  setCommunity(community: ComposerCommunity | undefined) {
    set({
      ...state,
      community,
      // Member-only content belongs to a community
      ...(community ? {} : {memberOnly: false, memberOnlyText: ''}),
    })
  },
  reset: () => set(initial),
  /** A community page asks the next composer to open with its community */
  presetCommunity(community: ComposerCommunity | undefined) {
    preset = community
  },
  /** Called once when a composer opens */
  consumePreset() {
    const community = preset
    preset = undefined
    set(community ? {...initial, community} : initial)
  },
}

export function useKraoComposerState(): KraoComposerState {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
    () => state,
  )
}
