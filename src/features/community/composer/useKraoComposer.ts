import {useEffect} from 'react'
import {toDatetimeString} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'

import * as Toast from '#/components/Toast'
import {useCreateGateMutation} from '#/features/gating/queries'
import {buildPollRecord, validatePollDraft} from '#/features/poll/logic'
import {containsSecret} from '#/features/safety/guard'
import {memberOnlyCondition} from '../logic'
import {kraoComposer, useKraoComposerState} from './store'

/**
 * The single hook point of the composer for Krao (communities and polls).
 * `isValid` gates the Post button; `getWrites` adds records to the post's
 * own atomic write; `afterPost` finishes what needs the published post.
 */
export function useKraoComposer() {
  const {t: l} = useLingui()
  const state = useKraoComposerState()
  const createGate = useCreateGateMutation()

  useEffect(() => {
    kraoComposer.consumePreset()
    return () => kraoComposer.reset()
  }, [])

  const memberOnlyProblem =
    !!state.community &&
    state.memberOnly &&
    (!state.memberOnlyText.trim() || containsSecret(state.memberOnlyText))
  const pollProblem = !!state.poll && validatePollDraft(state.poll).length > 0

  return {
    isValid: !memberOnlyProblem && !pollProblem,
    /** Records written in the same commit as the first post */
    getWrites(post: {uri: string; cid: string; rkey: string}) {
      const {community, poll} = kraoComposer.get()
      const now = new Date()
      const createdAt = toDatetimeString(now)
      const writes: unknown[] = []
      if (community) {
        writes.push({
          $type: 'com.atproto.repo.applyWrites#create',
          collection: 'net.krao.community.submission',
          value: {
            $type: 'net.krao.community.submission',
            community: community.uri,
            post: {uri: post.uri, cid: post.cid},
            createdAt,
          },
        })
      }
      if (poll) {
        writes.push({
          $type: 'com.atproto.repo.applyWrites#create',
          collection: 'net.krao.poll.poll',
          // The poll shares its post's record key
          rkey: post.rkey,
          value: buildPollRecord({
            draft: poll,
            post: {uri: post.uri, cid: post.cid},
            now,
            toDatetime: toDatetimeString,
          }),
        })
      }
      return writes as never[]
    },
    /** The member-only content is stored once the post exists */
    async afterPost(post: {uri: string; cid: string}) {
      const {community, memberOnly, memberOnlyText} = kraoComposer.get()
      if (!community || !memberOnly || !memberOnlyText.trim()) return
      try {
        await createGate.mutateAsync({
          post,
          text: memberOnlyText.trim(),
          condition: memberOnlyCondition(community.uri),
        })
      } catch {
        Toast.show(
          l`Your post was sent, but the members-only text could not be saved.`,
          {type: 'error'},
        )
      }
    },
  }
}
