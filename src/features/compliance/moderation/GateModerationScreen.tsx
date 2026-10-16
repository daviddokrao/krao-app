import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {GatedVideo} from '#/features/gating/components/GatedVideo'
import {
  AccountName,
  EmptyRow,
  LoadMore,
  useFormatDate,
  useResolveAccount,
} from '#/features/referral/admin/components/shared'
import {ServiceError} from '../api'
import {parsePostRef} from './postRef'
import {
  type AccessLogEntry,
  accessLogKey,
  type ModeratedContent,
  useAccessLogQuery,
  useIsGateModeratorQuery,
  useModerationContentMutation,
} from './queries'
import {buildReadReason, READ_REASONS, type ReadReason} from './reason'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'GateModeration'>

/**
 * Moderators: read the gated content of a reported post and see who read
 * what. Every read needs a reason and is logged by the gate service.
 */
export function GateModerationScreen({}: Props) {
  const {t: l} = useLingui()
  const {data: isModerator, isLoading, isError} = useIsGateModeratorQuery()

  return (
    <Layout.Screen testID="gateModerationScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>View gated content</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_xl]} aria-label={l`Gate moderation`}>
          {isLoading ? (
            <Loader />
          ) : isError ? (
            <Admonition.Admonition type="error">
              <Trans>Could not reach the gate service.</Trans>
            </Admonition.Admonition>
          ) : !isModerator ? (
            <Admonition.Admonition type="error">
              <Trans>You do not have permission to view gated content.</Trans>
            </Admonition.Admonition>
          ) : (
            <>
              <ContentViewer />
              <AccessLog />
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function ContentViewer() {
  const t = useTheme()
  const {t: l} = useLingui()
  const resolve = useResolveAccount()
  const read = useModerationContentMutation()
  const queryClient = useQueryClient()
  const [post, setPost] = useState('')
  const [category, setCategory] = useState<ReadReason>()
  const [reportId, setReportId] = useState('')
  const [error, setError] = useState('')
  const [content, setContent] = useState<ModeratedContent>()
  const [busy, setBusy] = useState(false)
  const reasonLabels: Record<ReadReason, string> = {
    report: l`User report`,
    legal: l`Legal request`,
    appeal: l`Appeal`,
    other: l`Other`,
  }

  const onView = async () => {
    setError('')
    setContent(undefined)
    const ref = parsePostRef(post)
    if (!ref) {
      setError(l`Enter a post link or an AT URI (at://…/app.bsky.feed.post/…).`)
      return
    }
    if (!category) {
      setError(l`Choose why you are reading it.`)
      return
    }
    const reason = buildReadReason(category, reportId)
    if (!reason) {
      setError(
        l`A report id can only have letters, numbers, dashes and underscores.`,
      )
      return
    }
    setBusy(true)
    try {
      const uri =
        'uri' in ref
          ? ref.uri
          : `at://${await resolve(ref.name)}/app.bsky.feed.post/${ref.rkey}`
      const result = await read.mutateAsync({uri, reason})
      setContent(result)
    } catch (err) {
      if (err instanceof ServiceError && err.status === 403) {
        setError(l`You do not have permission to view gated content.`)
      } else if (err instanceof ServiceError && err.error === 'NotFound') {
        setError(l`This post has no gated content.`)
      } else if (err instanceof ServiceError && err.message) {
        setError(err.message)
      } else {
        setError(l`Could not read the post. Check the link and try again.`)
      }
    } finally {
      setBusy(false)
      // The read is logged even when there was nothing to show
      void queryClient.invalidateQueries({queryKey: accessLogKey()})
    }
  }

  return (
    <View style={[a.gap_md]}>
      <Admonition.Admonition type="info">
        <Trans>
          Every read is logged with your account and the reason you choose. Do
          not share what you see outside the report.
        </Trans>
      </Admonition.Admonition>
      <View>
        <TextField.LabelText>
          <Trans>Post link or AT URI</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="gateModerationUri"
            label={l`Post link or AT URI`}
            value={post}
            onChangeText={setPost}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://krao.net/profile/…/post/…"
          />
        </TextField.Root>
      </View>
      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Reason (required)</Trans>
        </TextField.LabelText>
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {READ_REASONS.map(option => (
            <Button
              key={option}
              testID={`gateModerationReason-${option}`}
              label={
                option === category
                  ? l`${reasonLabels[option]}, selected`
                  : reasonLabels[option]
              }
              color={option === category ? 'primary' : 'secondary'}
              size="small"
              onPress={() => setCategory(option)}>
              <ButtonText>{reasonLabels[option]}</ButtonText>
            </Button>
          ))}
        </View>
        <TextField.Root>
          <TextField.Input
            testID="gateModerationReportId"
            label={l`Report id (optional)`}
            placeholder={l`Report id (optional)`}
            value={reportId}
            onChangeText={setReportId}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
          />
        </TextField.Root>
      </View>
      {!!error && (
        <Admonition.Admonition type="error">{error}</Admonition.Admonition>
      )}
      <Button
        testID="gateModerationView"
        label={l`View gated content`}
        color="primary"
        size="large"
        disabled={busy}
        onPress={() => void onView()}>
        {busy && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>View gated content</Trans>
        </ButtonText>
      </Button>

      {content && (
        <View
          testID="gateModerationResult"
          style={[
            a.gap_sm,
            a.p_md,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
          ]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]} selectable>
            {content.uri}
          </Text>
          {!!content.text && (
            <Text style={[a.text_lg, a.leading_snug]} emoji selectable>
              {content.text}
            </Text>
          )}
          {content.media?.map(media =>
            media.mimeType.startsWith('video/') ? (
              <GatedVideo key={media.url} media={media} />
            ) : (
              <Image
                key={media.url}
                source={{uri: media.url}}
                style={[
                  a.w_full,
                  a.rounded_sm,
                  {
                    aspectRatio: media.aspectRatio
                      ? media.aspectRatio.width / media.aspectRatio.height
                      : 1,
                    maxHeight: 480,
                  },
                ]}
                contentFit="contain"
                cachePolicy="none"
                accessibilityLabel={media.alt || l`Gated image`}
                accessibilityHint=""
                accessibilityIgnoresInvertColors
              />
            ),
          )}
          {!content.text && !content.media?.length && <EmptyRow />}
        </View>
      )}
    </View>
  )
}

function AccessLog() {
  const t = useTheme()
  const formatDate = useFormatDate()
  const log = useAccessLogQuery({enabled: true})
  const entries: AccessLogEntry[] =
    log.data?.pages.flatMap(page => page.entries) ?? []

  return (
    <View style={[a.gap_md]} testID="gateAccessLog">
      <Text style={[a.text_lg, a.font_semi_bold]}>
        <Trans>Who read gated content</Trans>
      </Text>
      {log.isLoading ? (
        <Loader />
      ) : log.isError ? (
        <Admonition.Admonition type="error">
          <Trans>Could not load the access log.</Trans>
        </Admonition.Admonition>
      ) : !entries.length ? (
        <EmptyRow />
      ) : (
        entries.map(entry => (
          <View
            key={entry.id}
            style={[
              a.gap_2xs,
              a.p_md,
              a.rounded_md,
              a.border,
              t.atoms.border_contrast_low,
            ]}>
            <AccountName did={entry.moderator} />
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]} selectable>
              {entry.uri}
            </Text>
            {!!entry.reason && <Text style={[a.text_sm]}>{entry.reason}</Text>}
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {formatDate(entry.accessedAt)}
            </Text>
          </View>
        ))
      )}
      <LoadMore query={log} />
    </View>
  )
}
