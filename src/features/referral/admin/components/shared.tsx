import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {useAppviewClient} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'

/** Resolves what an admin typed (a handle, @handle or DID) to a DID */
export function useResolveAccount() {
  const client = useAppviewClient()
  return async (input: string) => {
    const actor = input.trim().replace(/^@/, '')
    if (!actor) throw new Error('Enter a handle')
    const profile = await client.call(app.bsky.actor.getProfile, {
      actor: actor as `${string}.${string}`,
    })
    return profile.did as string
  }
}

/** An account's display name and handle, by DID */
export function AccountName({did}: {did: string}) {
  const t = useTheme()
  const {data} = useProfileQuery({did})
  if (!data) {
    return (
      <Text style={[a.text_md]} numberOfLines={1}>
        {did}
      </Text>
    )
  }
  return (
    <Text emoji style={[a.text_md]} numberOfLines={1}>
      {data.displayName ? `${data.displayName} ` : ''}
      <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
        {sanitizeHandle(data.handle, '@')}
      </Text>
    </Text>
  )
}

export function EmptyRow() {
  const t = useTheme()
  return (
    <Text style={[a.text_md, a.italic, a.p_lg, t.atoms.text_contrast_medium]}>
      <Trans>Nothing here.</Trans>
    </Text>
  )
}

/** Formats admin timestamps in the app's language */
export function useFormatDate() {
  const {i18n} = useLingui()
  return (iso: string) =>
    i18n.date(new Date(iso), {dateStyle: 'medium', timeStyle: 'short'})
}
