import {useEffect} from 'react'
import {toDatetimeString} from '@atproto/syntax'

import {usePrepareGateForNewPost} from '#/features/gating/queries'
import {buildPollRecord, validatePollDraft} from '#/features/poll/logic'
import {containsSecret} from '#/features/safety/guard'
import {memberOnlyCondition} from '../logic'
import {kraoComposer, useKraoComposerState} from './store'

/**
 * The single hook point of the composer for Krao (communities and polls).
 * `isValid` gates the Post button; `getWrites` adds records to the post's
 * own atomic write.
 */
export function useKraoComposer() {
  const state = useKraoComposerState()
  const prepareGate = usePrepareGateForNewPost()

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
    /**
     * Records written in the same commit as the first post. The members-only
     * text is stored on the gate service first; if that fails, this throws
     * and nothing is published.
     */
    async getWrites(post: {uri: string; cid: string; rkey: string}) {
      const {community, poll, memberOnly, memberOnlyText} = kraoComposer.get()
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
        const text = memberOnlyText.trim()
        if (memberOnly && text) {
          writes.push({
            $type: 'com.atproto.repo.applyWrites#create',
            collection: 'net.krao.gate.rule',
            value: await prepareGate({
              post: {uri: post.uri, cid: post.cid},
              text,
              condition: memberOnlyCondition(community.uri),
            }),
          })
        }
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
  }
}
