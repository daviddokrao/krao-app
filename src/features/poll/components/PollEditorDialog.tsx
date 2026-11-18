import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {Choice} from '#/features/community/components/Choice'
import {TIP_ASSETS} from '#/features/tips/assets'
import {
  DURATION_HOURS,
  emptyPollDraft,
  OPTION_MAX_GRAPHEMES,
  OPTIONS_MAX,
  OPTIONS_MIN,
  type PollDraft,
  type PollMode,
  QUESTION_MAX_GRAPHEMES,
  validatePollDraft,
} from '../logic'

/** Words for the poll modes, shared with the poll in a post */
export function usePollModeText() {
  const {t: l} = useLingui()
  return (mode: PollMode) => {
    switch (mode) {
      case 'verified':
        return {
          title: l`Verified people`,
          description: l`One vote per verified account.`,
        }
      case 'token':
        return {
          title: l`Weighted by token balance`,
          description: l`Each vote counts as the voter’s balance at the time the poll starts. Shows results only, no money moves.`,
        }
      default:
        return {
          title: l`One account, one vote`,
          description: l`Every account counts once.`,
        }
    }
  }
}

function useDurationLabel() {
  const {t: l} = useLingui()
  return (hours: number) => {
    if (hours === 1) return l`1 hour`
    if (hours === 24) return l`1 day`
    if (hours === 72) return l`3 days`
    if (hours === 168) return l`7 days`
    return l`30 days`
  }
}

/**
 * Edits the draft of a poll in the composer. Saving hands the draft to
 * `onSave`; an existing poll can be removed.
 */
export function PollEditorDialog({
  control,
  poll,
  onSave,
  onRemove,
}: {
  control: Dialog.DialogControlProps
  poll: PollDraft | undefined
  onSave: (poll: PollDraft) => void
  onRemove: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Poll`} style={web({maxWidth: 480})}>
        <PollEditorInner
          control={control}
          poll={poll}
          onSave={onSave}
          onRemove={onRemove}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PollEditorInner({
  control,
  poll,
  onSave,
  onRemove,
}: {
  control: Dialog.DialogControlProps
  poll: PollDraft | undefined
  onSave: (poll: PollDraft) => void
  onRemove: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const modeText = usePollModeText()
  const durationLabel = useDurationLabel()
  const [draft, setDraft] = useState<PollDraft>(poll ?? emptyPollDraft())
  const problems = validatePollDraft(draft)
  const patch = (next: Partial<PollDraft>) =>
    setDraft(prev => ({...prev, ...next}))

  const setOption = (index: number, value: string) =>
    setDraft(prev => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? value : o)),
    }))

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Add a poll</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            Votes are public records, and they can’t be changed once cast.
          </Trans>
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Question (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="pollQuestionInput"
            label={l`Poll question`}
            placeholder={l`Ask something, or let your post be the question`}
            value={draft.question}
            onChangeText={question => patch({question})}
            maxLength={QUESTION_MAX_GRAPHEMES}
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Options</Trans>
        </TextField.LabelText>
        {draft.options.map((option, i) => (
          <View key={i} style={[a.flex_row, a.gap_sm, a.align_center]}>
            <View style={[a.flex_1]}>
              <TextField.Root>
                <TextField.Input
                  testID={`pollOption${i}`}
                  label={l`Option ${i + 1}`}
                  placeholder={l`Option ${i + 1}`}
                  value={option}
                  onChangeText={value => setOption(i, value)}
                  maxLength={OPTION_MAX_GRAPHEMES}
                />
              </TextField.Root>
            </View>
            {draft.options.length > OPTIONS_MIN && (
              <Button
                label={l`Remove option ${i + 1}`}
                color="secondary"
                size="small"
                shape="round"
                onPress={() =>
                  setDraft(prev => ({
                    ...prev,
                    options: prev.options.filter((_, j) => j !== i),
                  }))
                }>
                <ButtonIcon icon={XIcon} />
              </Button>
            )}
          </View>
        ))}
        {draft.options.length < OPTIONS_MAX && (
          <Button
            testID="pollAddOption"
            label={l`Add an option`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() =>
              setDraft(prev => ({...prev, options: [...prev.options, '']}))
            }>
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans>Add option</Trans>
            </ButtonText>
          </Button>
        )}
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Poll length</Trans>
        </TextField.LabelText>
        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {DURATION_HOURS.map(hours => (
            <Button
              key={hours}
              label={
                draft.durationHours === hours
                  ? l`${durationLabel(hours)}, selected`
                  : durationLabel(hours)
              }
              color={
                draft.durationHours === hours ? 'primary_subtle' : 'secondary'
              }
              size="small"
              onPress={() => patch({durationHours: hours})}>
              <ButtonText>{durationLabel(hours)}</ButtonText>
            </Button>
          ))}
        </View>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Who can vote</Trans>
        </TextField.LabelText>
        {(['account', 'verified', 'token'] as const).map(mode => (
          <Choice
            key={mode}
            testID={`pollMode-${mode}`}
            selected={draft.mode === mode}
            title={modeText(mode).title}
            description={modeText(mode).description}
            onPress={() =>
              patch({
                mode,
                asset: mode === 'token' ? draft.asset || TIP_ASSETS[1].id : '',
              })
            }
          />
        ))}
        {draft.mode === 'token' && (
          <View style={[a.flex_row, a.gap_sm]}>
            {TIP_ASSETS.map(asset => (
              <Button
                key={asset.id}
                label={
                  draft.asset === asset.id
                    ? l`${asset.symbol}, selected`
                    : asset.symbol
                }
                color={
                  draft.asset === asset.id ? 'primary_subtle' : 'secondary'
                }
                size="small"
                onPress={() => patch({asset: asset.id})}>
                <ButtonText>
                  {asset.symbol} <Trans>on Base</Trans>
                </ButtonText>
              </Button>
            ))}
          </View>
        )}
        {draft.mode !== 'account' && (
          <Admonition type="info">
            {draft.mode === 'verified' ? (
              <Trans>
                Each vote is a public record. It shows that the voter’s account
                is verified.
              </Trans>
            ) : (
              <Trans>
                Each vote is a public record. It can reveal that the voter holds
                this token in a linked wallet.
              </Trans>
            )}
          </Admonition>
        )}
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Results</Trans>
        </TextField.LabelText>
        <Choice
          selected={draft.resultsVisibility === 'always'}
          title={l`Show results while voting`}
          onPress={() => patch({resultsVisibility: 'always'})}
        />
        <Choice
          selected={draft.resultsVisibility === 'afterEnd'}
          title={l`Show results after the poll ends`}
          onPress={() => patch({resultsVisibility: 'afterEnd'})}
        />
      </View>

      <View style={[a.gap_sm]}>
        <Button
          testID="pollSave"
          label={l`Save poll`}
          color="primary"
          size="large"
          disabled={problems.length > 0}
          onPress={() => control.close(() => onSave(draft))}>
          <ButtonText>
            <Trans>Save poll</Trans>
          </ButtonText>
        </Button>
        {poll && (
          <Button
            testID="pollRemove"
            label={l`Remove poll`}
            color="negative_subtle"
            size="large"
            onPress={() => control.close(onRemove)}>
            <ButtonText>
              <Trans>Remove poll</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}
