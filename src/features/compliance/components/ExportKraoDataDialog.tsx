import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {saveBytesToDisk} from '#/lib/media/manip'
import {logger} from '#/logger'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {type KraoDataExport, useExportKraoDataMutation} from '../queries'

/**
 * Settings > Account > "Download my Krao data": what Krao's own services
 * (points, referrals, identity and phone status, wallets, tips, gates, chat,
 * push devices) hold about the account, as one JSON file. The public
 * repository export (CAR) is the upstream item next to it.
 */
export function ExportKraoDataDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const exportData = useExportKraoDataMutation()

  const onDownload = () => {
    exportData.mutate(undefined, {
      onSuccess: data => void save(data),
      onError: e => {
        logger.error('Error occurred while exporting Krao data', {message: e})
        Toast.show(l`Could not download your Krao data. Try again later.`, {
          type: 'error',
        })
      },
    })
  }

  const save = async (data: KraoDataExport) => {
    try {
      const failed = Object.entries(data.services).filter(
        ([, part]) => 'error' in part,
      ).length
      const saved = await saveBytesToDisk(
        'krao-data.json',
        new TextEncoder().encode(JSON.stringify(data, null, 2)),
        'application/json',
      )
      if (saved) {
        Toast.show(
          failed
            ? l`File saved, but some Krao data could not be included.`
            : l`File saved successfully!`,
          {type: failed ? 'warning' : 'success'},
        )
      }
    } catch (e) {
      logger.error('Error occurred while saving Krao data', {message: e})
      Toast.show(l`Error occurred while saving file`, {type: 'error'})
    }
  }

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Download my Krao data`}
        style={web({maxWidth: 500})}>
        <View style={[a.relative, a.w_full]}>
          <Text style={[a.mb_sm, a.text_2xl, a.font_bold]}>
            <Trans>Download my Krao data</Trans>
          </Text>
          <Text
            style={[
              a.mb_lg,
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_high,
            ]}>
            <Trans>
              Krao keeps some data outside your public repository: your points
              and referrals, identity and phone verification status, linked
              wallets, tips, gated posts, chat messages and notification
              devices. This file has all of it, as JSON.
            </Trans>
          </Text>
          <Button
            testID="downloadKraoDataButton"
            color="primary"
            size="large"
            label={l`Download Krao data`}
            disabled={exportData.isPending}
            onPress={onDownload}>
            <ButtonIcon icon={exportData.isPending ? Loader : DownloadIcon} />
            <ButtonText>
              <Trans context="button">Download Krao data</Trans>
            </ButtonText>
          </Button>
        </View>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
