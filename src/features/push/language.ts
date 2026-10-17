import {type Client} from '@atproto/lex'

import {KRAO_REWARDS_DID} from '#/env'
import {com, net} from '#/lexicons'
import {rewardsFetch} from '../referral/api'

/**
 * The language tag to give the push service: the app's UI language. Pushes are
 * written in Vietnamese for `vi` and in English otherwise, which the service
 * decides; we only report the tag. Anything that is not a plausible BCP-47 tag
 * (the lexicon allows up to 35 characters) falls back to English.
 */
export function pushLanguageTag(appLanguage: string | undefined): string {
  const tag = (appLanguage ?? '').trim().replace(/_/g, '-')
  return /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag) && tag.length <= 35
    ? tag
    : 'en'
}

/**
 * Tell Krao which language to write this account's pushes in. Answered by the
 * rewards service (service auth from the user's PDS, audience = rewards DID),
 * which passes it on to the push service.
 */
export async function setPushLanguage(client: Client, appLanguage: string) {
  const {token} = await client.call(com.atproto.server.getServiceAuth, {
    aud: KRAO_REWARDS_DID,
    lxm: net.krao.push.setLanguage.$lxm,
  })
  const input: net.krao.push.setLanguage.$InputBody = {
    language: pushLanguageTag(appLanguage),
  }
  await rewardsFetch<net.krao.push.setLanguage.$OutputBody>(
    net.krao.push.setLanguage.$lxm,
    {token, body: input},
  )
}
