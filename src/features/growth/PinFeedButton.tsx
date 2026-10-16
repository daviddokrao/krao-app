import {useEffect, useState} from 'react'
import {useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {
  useAddSavedFeedsMutation,
  usePreferencesQuery,
  useRemoveFeedMutation,
  useUpdateSavedFeedsMutation,
} from '#/state/queries/preferences'
import {useSession} from '#/state/session'
import {
  Button,
  ButtonIcon,
  type ButtonProps,
  ButtonText,
} from '#/components/Button'
import {Pin_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/Pin'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {toDidFeedUri} from './viFeed'

/**
 * Pins a feed (a generator at-uri) to the viewer's feeds, or unpins it. Uses
 * the saved feeds of the account, so the feed shows up as a tab on Home.
 * Needs a session; renders nothing without one.
 */
export function PinFeedButton({
  uri,
  pinLabel,
  unpinLabel,
  testID,
  size = 'small',
}: {
  uri: string
  /** The accessible label and text of the button while the feed is not pinned */
  pinLabel: string
  unpinLabel: string
  testID?: string
  size?: ButtonProps['size']
}) {
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const {data: preferences} = usePreferencesQuery()
  const add = useAddSavedFeedsMutation()
  const update = useUpdateSavedFeedsMutation()
  const remove = useRemoveFeedMutation()
  // Saved feeds are keyed by DID: a handle in the uri is resolved first
  const [didUri, setDidUri] = useState<string | undefined>()
  useEffect(() => {
    let cancelled = false
    void toDidFeedUri(uri).then(res => {
      if (!cancelled) setDidUri(res)
    })
    return () => {
      cancelled = true
    }
  }, [uri])

  if (!hasSession || !didUri) return null

  const saved = preferences?.savedFeeds.find(feed => feed.value === didUri)
  const pinned = !!saved?.pinned
  const busy = add.isPending || update.isPending || remove.isPending

  const onPress = async () => {
    try {
      if (!saved) {
        await add.mutateAsync([{type: 'feed', value: didUri, pinned: true}])
      } else if (!saved.pinned) {
        await update.mutateAsync([{...saved, pinned: true}])
      } else {
        await remove.mutateAsync(saved)
      }
      Toast.show(l({message: 'Feeds updated!', context: 'toast'}))
    } catch (e) {
      logger.error('Failed to pin a feed', {message: e})
      Toast.show(l`Failed to update feeds`, {type: 'error'})
    }
  }

  return (
    <Button
      testID={testID}
      label={pinned ? unpinLabel : pinLabel}
      color={pinned ? 'secondary' : 'primary'}
      size={size}
      disabled={busy}
      onPress={() => void onPress()}>
      <ButtonIcon icon={busy ? Loader : PinIcon} />
      <ButtonText>{pinned ? unpinLabel : pinLabel}</ButtonText>
    </Button>
  )
}
