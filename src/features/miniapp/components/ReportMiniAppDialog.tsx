import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation} from '@tanstack/react-query'

import {modProxyService} from '#/lib/constants'
import {useAppviewClient} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {com} from '#/lexicons'
import {type MiniAppView} from '../logic'

type ReportInput = com.atproto.moderation.createReport.$InputBody

/**
 * Report a Mini App to Krao's moderators: a report whose subject is the
 * app's record (uri and cid), so it is about the version the reporter saw.
 */
export function useReportMiniAppMutation() {
  const client = useAppviewClient()
  return useMutation({
    mutationFn: async ({
      app,
      details,
    }: {
      app: Pick<MiniAppView, 'uri' | 'cid'>
      details: string
    }) => {
      const report = {
        reasonType: com.atproto.moderation.defs.reasonOther.value,
        reason: details.trim() || undefined,
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: app.uri,
          cid: app.cid,
        },
      } as unknown as ReportInput
      await client.call(com.atproto.moderation.createReport, report, {
        service: modProxyService(),
      })
    },
  })
}

export function ReportMiniAppDialog({
  control,
  app,
}: {
  control: Dialog.DialogControlProps
  app: Pick<MiniAppView, 'uri' | 'cid' | 'name'>
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Report Mini App`}
        style={web({maxWidth: 440})}>
        <ReportInner control={control} app={app} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function ReportInner({
  control,
  app,
}: {
  control: Dialog.DialogControlProps
  app: Pick<MiniAppView, 'uri' | 'cid' | 'name'>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const report = useReportMiniAppMutation()
  const [details, setDetails] = useState('')

  const onSubmit = () =>
    report.mutate(
      {app, details},
      {
        onSuccess: () =>
          control.close(() => {
            Toast.show(l`Thanks. Krao’s moderators will look at it.`, {
              type: 'success',
            })
          }),
      },
    )

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Report Mini App</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Tell Krao what is wrong with {app.name}: a scam, a fake login, a
            request that looks like theft. Krao can take it down.
          </Trans>
        </Text>
      </View>
      <TextField.Root>
        <TextField.Input
          testID="reportMiniAppDetails"
          label={l`What is wrong`}
          placeholder={l`What is wrong (optional)`}
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={4}
          maxLength={2000}
        />
      </TextField.Root>
      {report.isError && (
        <Admonition type="error">
          <Trans>The report could not be sent. Please try again.</Trans>
        </Admonition>
      )}
      <Button
        testID="reportMiniAppSubmit"
        label={l`Send report`}
        color="primary"
        size="large"
        disabled={report.isPending}
        onPress={onSubmit}>
        {report.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Send report</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
