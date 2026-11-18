import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {
  EMPTY_PLAN_DRAFT,
  isPlanDraftValid,
  PERK_MAX,
  PLAN_DESCRIPTION_MAX,
  PLAN_NAME_MAX,
  PLAN_PERKS_MAX,
  type PlanDraft,
  PRICE_MAX_USD,
  PRICE_MIN_USD,
  priceToInput,
  validatePlanDraft,
} from '../logic'
import {type OwnPlan, useSavePlanMutation} from '../queries'

function draftOf(plan: OwnPlan | undefined): PlanDraft {
  if (!plan) return EMPTY_PLAN_DRAFT
  return {
    name: plan.record.name,
    description: plan.record.description ?? '',
    price: priceToInput(plan.record.priceUsdc),
    perks: (plan.record.perks ?? []).join('\n'),
  }
}

/** Create a plan, or edit one (`plan`) */
export function PlanDialog({
  control,
  plan,
  openCount,
}: {
  control: Dialog.DialogControlProps
  plan?: OwnPlan
  /** Changes each time the dialog is opened, so the form starts afresh */
  openCount: number
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={plan ? l`Edit plan` : l`New plan`}
        style={web({maxWidth: 460})}>
        <PlanDialogInner key={openCount} control={control} plan={plan} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PlanDialogInner({
  control,
  plan,
}: {
  control: Dialog.DialogControlProps
  plan?: OwnPlan
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const save = useSavePlanMutation()
  const [draft, setDraft] = useState(() => draftOf(plan))
  const [touched, setTouched] = useState(false)
  const errors = touched ? validatePlanDraft(draft) : {}
  const set = (key: keyof PlanDraft) => (value: string) =>
    setDraft(prev => ({...prev, [key]: value}))

  const onSave = () => {
    if (!isPlanDraftValid(draft)) {
      setTouched(true)
      return
    }
    save.mutate(
      {draft, existing: plan, active: plan?.record.active ?? true},
      {
        onSuccess: () =>
          control.close(() => {
            Toast.show(plan ? l`Plan saved` : l`Plan created`, {
              type: 'success',
            })
          }),
      },
    )
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          {plan ? <Trans>Edit plan</Trans> : <Trans>New plan</Trans>}
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            People who join pay this price in USDC for each 30 days. People who
            already joined keep the price they paid until their period ends.
          </Trans>
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Name</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!errors.name}>
          <TextField.Input
            testID="planNameInput"
            label={l`Plan name`}
            value={draft.name}
            onChangeText={set('name')}
            maxLength={PLAN_NAME_MAX}
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Price per 30 days (USDC)</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!errors.price}>
          <TextField.Input
            testID="planPriceInput"
            label={l`Price in USDC`}
            value={draft.price}
            onChangeText={set('price')}
            keyboardType="decimal-pad"
          />
        </TextField.Root>
        <Text
          style={[
            a.text_xs,
            errors.price
              ? {color: t.palette.negative_500}
              : t.atoms.text_contrast_medium,
          ]}>
          <Trans>
            Between {PRICE_MIN_USD} and {PRICE_MAX_USD} USDC.
          </Trans>
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Description (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!errors.description}>
          <TextField.Input
            label={l`Plan description`}
            value={draft.description}
            onChangeText={set('description')}
            multiline
            numberOfLines={3}
            maxLength={PLAN_DESCRIPTION_MAX}
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Perks (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!!errors.perks}>
          <TextField.Input
            label={l`Plan perks, one per line`}
            value={draft.perks}
            onChangeText={set('perks')}
            multiline
            numberOfLines={4}
          />
        </TextField.Root>
        <Text
          style={[
            a.text_xs,
            errors.perks
              ? {color: t.palette.negative_500}
              : t.atoms.text_contrast_medium,
          ]}>
          <Trans>
            One per line. Up to {PLAN_PERKS_MAX} perks of {PERK_MAX} characters
            each.
          </Trans>
        </Text>
      </View>

      {save.error && (
        <Admonition type="error">{cleanError(save.error)}</Admonition>
      )}

      <Button
        testID="savePlanButton"
        label={l`Save plan`}
        color="primary"
        size="large"
        disabled={save.isPending}
        onPress={onSave}>
        {save.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>
          <Trans>Save plan</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
