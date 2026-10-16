import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {createQueryKey} from '#/state/queries/util'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {getAppRequest} from '../api'
import {canRunApp, type MiniAppView, parseMiniAppLink} from '../logic'
import {useApprovedAppsQuery} from '../queries'
import {MiniAppIcon} from './MiniAppIcon'

export type PickedMiniApp = {uri: string; cid: string; name: string}

/**
 * Picks the Mini App a new post carries: one of the approved apps, or one
 * pasted by link. Only an approved app can be attached, and the post points
 * at the version (cid) that was approved when it was picked.
 */
export function MiniAppPickerDialog({
  control,
  selected,
  onPick,
  onRemove,
}: {
  control: Dialog.DialogControlProps
  selected?: PickedMiniApp
  onPick: (app: PickedMiniApp) => void
  onRemove: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Add a Mini App`}
        style={web({maxWidth: 480})}>
        <PickerInner
          control={control}
          selected={selected}
          onPick={onPick}
          onRemove={onRemove}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PickerInner({
  control,
  selected,
  onPick,
  onRemove,
}: {
  control: Dialog.DialogControlProps
  selected?: PickedMiniApp
  onPick: (app: PickedMiniApp) => void
  onRemove: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const approved = useApprovedAppsQuery()
  const [link, setLink] = useState('')
  const linkUri = parseMiniAppLink(link)
  const linked = useQuery({
    enabled: !!linkUri,
    staleTime: 0,
    retry: false,
    queryKey: createQueryKey('krao-miniapp-link', {uri: linkUri ?? ''}),
    queryFn: () => getAppRequest(linkUri!),
  })
  const apps = approved.data?.pages.flatMap(p => p.apps) ?? []

  const pick = (app: MiniAppView) =>
    control.close(() => onPick({uri: app.uri, cid: app.cid, name: app.name}))

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Add a Mini App</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            The post shows a card people can tap to open the Mini App. Only apps
            Krao has approved can be added.
          </Trans>
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Paste a Mini App link</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="miniAppLinkInput"
            label={l`Mini App link`}
            placeholder={l`Link to a Mini App`}
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>
        {!!link.trim() && !linkUri && (
          <Admonition type="error">
            <Trans>That is not a Mini App link.</Trans>
          </Admonition>
        )}
        {linkUri && linked.isLoading && <Loader />}
        {linkUri && linked.isError && (
          <Admonition type="error">
            <Trans>Could not find that Mini App.</Trans>
          </Admonition>
        )}
        {linked.data && !canRunApp(linked.data) && (
          <Admonition type="warning">
            <Trans>
              {linked.data.name} has not been approved by Krao, so it can’t be
              added to a post.
            </Trans>
          </Admonition>
        )}
        {linked.data && canRunApp(linked.data) && (
          <AppRow app={linked.data} onPress={() => pick(linked.data)} />
        )}
      </View>

      <View style={[a.gap_sm]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Approved Mini Apps</Trans>
        </Text>
        {approved.isLoading ? (
          <Loader />
        ) : approved.isError ? (
          <Admonition type="error">
            <Trans>Could not load Mini Apps.</Trans>
          </Admonition>
        ) : apps.length === 0 ? (
          <Admonition type="info">
            <Trans>There are no approved Mini Apps yet.</Trans>
          </Admonition>
        ) : (
          apps.map(app => (
            <AppRow key={app.uri} app={app} onPress={() => pick(app)} />
          ))
        )}
      </View>

      {selected && (
        <Button
          testID="miniAppRemoveButton"
          label={l`Remove ${selected.name} from this post`}
          color="negative_subtle"
          size="large"
          onPress={() => control.close(onRemove)}>
          <ButtonText>
            <Trans>Remove Mini App</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )
}

function AppRow({app, onPress}: {app: MiniAppView; onPress: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Button
      testID={`miniAppOption-${app.name}`}
      label={l`Add ${app.name}`}
      color="secondary"
      size="large"
      onPress={onPress}
      style={[a.justify_start]}>
      <View style={[a.flex_row, a.gap_md, a.align_center, a.flex_1]}>
        <MiniAppIcon
          name={app.name}
          uri={app.uri}
          iconUrl={app.iconUrl}
          size={36}
        />
        <View style={[a.flex_1]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
            {app.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {app.origin}
          </Text>
        </View>
      </View>
    </Button>
  )
}
