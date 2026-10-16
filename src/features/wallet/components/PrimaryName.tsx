import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon} from '#/components/icons/Shield'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {type PrimaryName as PrimaryNameData} from '../api'
import {displayPrimaryName, shortAddress} from '../primaryName'
import {useChainProfileQuery} from '../queries'

/**
 * A verified Basename or ENS name under the handle. The wallet it points to
 * is linked to the account, so the name is the account's own. Press for what
 * that means. Nothing is shown without a verified primary name.
 */
export function ProfileHeaderPrimaryName({did}: {did: string}) {
  const {data} = useChainProfileQuery(did)
  if (!data?.primaryName) return null
  return <PrimaryName primaryName={data.primaryName} />
}

function PrimaryName({primaryName}: {primaryName: PrimaryNameData}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const name = displayPrimaryName(primaryName.name)
  return (
    <>
      <Button
        testID="profilePrimaryName"
        label={l`${primaryName.name}, a name that points to a wallet verified for this account`}
        accessibilityHint={l`Shows what this name means`}
        onPress={control.open}
        style={[a.self_start]}>
        {({pressed}) => (
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              {opacity: pressed ? 0.6 : 1},
            ]}>
            <ShieldCheckIcon size="sm" fill={t.palette.primary_500} />
            <Text
              emoji
              numberOfLines={1}
              style={[
                a.text_md,
                a.font_semi_bold,
                a.leading_snug,
                {color: t.palette.primary_500},
              ]}>
              {name}
            </Text>
          </View>
        )}
      </Button>
      <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <PrimaryNameDialog primaryName={primaryName} />
      </Dialog.Outer>
    </>
  )
}

function PrimaryNameDialog({primaryName}: {primaryName: PrimaryNameData}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  return (
    <Dialog.ScrollableInner label={l`Verified wallet name`}>
      <View style={[a.gap_md]}>
        <Text emoji selectable style={[a.text_xl, a.font_semi_bold]}>
          {primaryName.name}
        </Text>
        <Text style={[a.text_md, a.leading_snug]}>
          <Trans>This name points to a wallet verified for this account.</Trans>
        </Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {primaryName.source === 'basename' ? (
            <Trans>Basename</Trans>
          ) : (
            <Trans>ENS</Trans>
          )}
          {' · '}
          {shortAddress(primaryName.address)}
        </Text>
        {IS_NATIVE && (
          <Button
            label={l`Close`}
            color="secondary"
            size="small"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
