import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {InlineLinkText} from '#/components/Link'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {getTipAsset} from '#/features/tips/assets'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {
  getVoteBlock,
  isPollEnded,
  leadingOptions,
  optionShares,
  type PollMode,
  timeLeft,
} from '../logic'
import {type PollView, usePollQuery, useVoteMutation} from '../queries'
import {usePollModeText} from './PollEditorDialog'

/**
 * The poll of a post: vote while it runs, results when they may be shown.
 * Renders nothing for a post without a poll.
 */
export function PostPoll({uri, cid}: {uri: string; cid?: string}) {
  const {data: poll} = usePollQuery(uri)
  if (!poll) return null
  return <PollBody poll={poll} postCid={cid} />
}

function PollBody({poll, postCid}: {poll: PollView; postCid?: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const modeText = usePollModeText()
  const vote = useVoteMutation()
  const confirm = Prompt.usePromptControl()
  const [selected, setSelected] = useState<number>()

  const mode = poll.mode as PollMode
  const now = new Date()
  const ended = poll.ended || isPollEnded(poll.endsAt, now)
  /*
   * Until the indexer has read a vote just cast, a refetch comes back without
   * it; keep showing it as pending so the viewer is not offered a second vote
   */
  const voted =
    poll.viewer ??
    (vote.isSuccess && vote.variables
      ? {uri: vote.data, option: vote.variables.option, status: 'pending'}
      : undefined)
  const showResults = poll.resultsVisible
  const {data: chain} = useChainProfileQuery(
    mode === 'token' && hasSession && !ended && !voted
      ? currentAccount?.did
      : undefined,
  )
  const hasWallet = chain
    ? chain.wallets.some(w => w.status === 'verified')
    : undefined
  const block = getVoteBlock({
    ended,
    hasVoted: !!voted,
    signedIn: hasSession,
    mode,
    hasWallet,
  })
  const canPick = !block

  const shares = optionShares(poll.options, mode)
  const leaders = leadingOptions(poll.options, mode)
  const left = timeLeft(poll.endsAt, now)
  const asset = poll.asset ? getTipAsset(String(poll.asset)) : undefined

  const confirmText = () => {
    const final = l`Votes are final. You can’t change your vote, and deleting it and voting again won’t count.`
    if (mode === 'verified') {
      return `${final} ${l`Your vote is a public record and shows that your account is verified.`}`
    }
    if (mode === 'token') {
      const symbol = asset?.symbol ?? l`this token`
      return `${final} ${l`Your vote is a public record and can show that you hold ${symbol} in a linked wallet. It counts as your balance when the poll started.`}`
    }
    return final
  }

  return (
    <View
      testID="postPoll"
      style={[
        a.mt_sm,
        a.p_md,
        a.gap_sm,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_medium,
        t.atoms.bg_contrast_25,
      ]}>
      {poll.question ? (
        <Text emoji style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
          {poll.question}
        </Text>
      ) : null}

      <View style={[a.gap_xs]} accessibilityRole="radiogroup">
        {poll.options.map(option => {
          const share = shares.find(s => s.index === option.index)
          const mine = voted?.option === option.index
          const isSelected = selected === option.index
          const isLeader = ended && leaders.includes(option.index)
          if (canPick) {
            return (
              <Button
                key={option.index}
                testID={`pollOption-${option.index}`}
                label={isSelected ? l`${option.text}, selected` : option.text}
                color={isSelected ? 'primary_subtle' : 'secondary'}
                size="small"
                style={[a.justify_start]}
                onPress={() => setSelected(option.index)}>
                <ButtonText emoji style={[a.flex_1, a.text_left]}>
                  {option.text}
                </ButtonText>
              </Button>
            )
          }
          return (
            <ResultBar
              key={option.index}
              text={option.text}
              percent={showResults ? (share?.percent ?? 0) : undefined}
              mine={mine}
              leader={isLeader}
            />
          )
        })}
      </View>

      {block === 'needsWallet' && (
        <Admonition type="warning">
          <Trans>
            This poll counts your token balance, and you have no linked wallet.
            Your vote would count as zero, and you can only vote once.{' '}
            <InlineLinkText to="/settings/wallets" label={l`Link a wallet`}>
              Link a wallet first
            </InlineLinkText>
          </Trans>
        </Admonition>
      )}

      {canPick && (
        <Button
          testID="pollVoteButton"
          label={l`Vote`}
          color="primary"
          size="small"
          style={[a.self_start]}
          disabled={selected === undefined || vote.isPending}
          onPress={() => confirm.open()}>
          <ButtonText>
            <Trans>Vote</Trans>
          </ButtonText>
        </Button>
      )}

      {vote.error && (
        <Admonition type="error">{cleanError(vote.error)}</Admonition>
      )}

      {voted?.status === 'pending' && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Your vote is being counted.</Trans>
        </Text>
      )}
      {voted?.status === 'ignored' && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Your vote was not counted.</Trans>
        </Text>
      )}
      {voted?.status === 'counted' && mode === 'token' && voted.weight && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Your vote counted with the weight of your balance.</Trans>
        </Text>
      )}

      {block === 'signedOut' && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Sign in to vote.</Trans>
        </Text>
      )}
      {!showResults && !ended && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Results show when the poll ends.</Trans>
        </Text>
      )}

      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        {showResults && poll.totalVotes !== undefined ? (
          <>
            {plural(poll.totalVotes, {one: '# vote', other: '# votes'})}
            {' · '}
          </>
        ) : null}
        {modeText(mode).title}
        {mode === 'token' && asset ? ` (${asset.symbol})` : ''}
        {' · '}
        {ended ? (
          <Trans>Final results</Trans>
        ) : left?.unit === 'days' ? (
          plural(left.value, {one: '# day left', other: '# days left'})
        ) : left?.unit === 'hours' ? (
          plural(left.value, {one: '# hour left', other: '# hours left'})
        ) : left ? (
          plural(left.value, {one: '# minute left', other: '# minutes left'})
        ) : null}
      </Text>

      <Prompt.Basic
        control={confirm}
        title={l`Cast your vote?`}
        description={confirmText()}
        confirmButtonCta={l`Vote`}
        onConfirm={() => {
          if (selected === undefined) return
          vote.mutate({poll, option: selected, fallbackCid: postCid})
        }}
      />
    </View>
  )
}

function ResultBar({
  text,
  percent,
  mine,
  leader,
}: {
  text: string
  /** Undefined when the results are hidden */
  percent: number | undefined
  mine: boolean
  leader: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      accessible
      accessibilityHint=""
      accessibilityLabel={
        percent === undefined
          ? mine
            ? l`${text}, your vote`
            : text
          : mine
            ? l`${text}, ${percent} percent, your vote`
            : l`${text}, ${percent} percent`
      }
      style={[
        a.rounded_sm,
        a.overflow_hidden,
        a.justify_center,
        t.atoms.bg_contrast_50,
        {minHeight: 36},
      ]}>
      {percent !== undefined && (
        <View
          style={[
            a.absolute,
            a.inset_0,
            {
              width: `${percent}%`,
              backgroundColor: leader
                ? t.palette.primary_300
                : t.palette.primary_100,
            },
          ]}
        />
      )}
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.px_md, a.py_xs]}>
        <Text
          emoji
          style={[a.flex_1, a.text_sm, mine || leader ? a.font_bold : null]}>
          {text}
          {mine ? ' ✓' : ''}
        </Text>
        {percent !== undefined && (
          <Text style={[a.text_sm, a.font_semi_bold]}>{percent}%</Text>
        )}
      </View>
    </View>
  )
}
