import {Keyboard} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group3'
import {ListPlus_Stroke2_Corner0_Rounded as PollIcon} from '#/components/icons/List'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {Window_Stroke2_Corner2_Rounded as MiniAppIcon} from '#/components/icons/Window'
import {IS_NATIVE} from '#/env'
import {MiniAppPickerDialog} from '#/features/miniapp/components/MiniAppPickerDialog'
import {PollEditorDialog} from '#/features/poll/components/PollEditorDialog'
import {CommunityPickerDialog} from './CommunityPickerDialog'
import {kraoComposer, useKraoComposerState} from './store'

/**
 * The composer's Krao pills: post into a community, add a poll. Rendered in
 * the pills row of the first post of a new (non-reply) post.
 */
export function KraoComposerPills({
  hasOtherEmbed = false,
}: {
  /** The post already has media, a link card or a quote: a post has one embed */
  hasOtherEmbed?: boolean
}) {
  const {t: l} = useLingui()
  const state = useKraoComposerState()
  const communityControl = Dialog.useDialogControl()
  const pollControl = Dialog.useDialogControl()
  const miniAppControl = Dialog.useDialogControl()

  const open = (control: Dialog.DialogControlProps) => {
    if (IS_NATIVE && Keyboard.isVisible()) Keyboard.dismiss()
    control.open()
  }

  const communityLabel = state.community
    ? l`Posting to ${state.community.name}`
    : l`Post to a community`
  const pollLabel = state.poll ? l`Poll added` : l`Add a poll`
  const miniAppConflict = !!state.miniApp && hasOtherEmbed
  const miniAppLabel = miniAppConflict
    ? l`Mini App: remove the other attachment`
    : state.miniApp
      ? l`Mini App: ${state.miniApp.name}`
      : l`Add a Mini App`

  return (
    <>
      <Button
        testID="composerCommunityButton"
        color={state.community ? 'primary_subtle' : 'secondary'}
        size="small"
        label={communityLabel}
        accessibilityHint={l`Opens a dialog to choose a community for this post`}
        onPress={() => open(communityControl)}>
        <ButtonIcon icon={state.memberOnly ? LockIcon : GroupIcon} />
        <ButtonText numberOfLines={1} maxFontSizeMultiplier={2}>
          {communityLabel}
        </ButtonText>
      </Button>
      <Button
        testID="composerPollButton"
        color={state.poll ? 'primary_subtle' : 'secondary'}
        size="small"
        label={pollLabel}
        accessibilityHint={l`Opens a dialog to set up a poll`}
        onPress={() => open(pollControl)}>
        <ButtonIcon icon={PollIcon} />
        <ButtonText numberOfLines={1} maxFontSizeMultiplier={2}>
          {state.poll ? <Trans>Poll</Trans> : pollLabel}
        </ButtonText>
      </Button>
      <Button
        testID="composerMiniAppButton"
        color={
          miniAppConflict
            ? 'negative_subtle'
            : state.miniApp
              ? 'primary_subtle'
              : 'secondary'
        }
        size="small"
        label={miniAppLabel}
        accessibilityHint={l`Opens a dialog to choose a Mini App for this post`}
        onPress={() => open(miniAppControl)}>
        <ButtonIcon icon={MiniAppIcon} />
        <ButtonText numberOfLines={1} maxFontSizeMultiplier={2}>
          {miniAppLabel}
        </ButtonText>
      </Button>
      <CommunityPickerDialog control={communityControl} />
      <MiniAppPickerDialog
        control={miniAppControl}
        selected={state.miniApp}
        onPick={miniApp => kraoComposer.update({miniApp})}
        onRemove={() => kraoComposer.update({miniApp: undefined})}
      />
      <PollEditorDialog
        control={pollControl}
        poll={state.poll}
        onSave={poll => kraoComposer.update({poll})}
        onRemove={() => kraoComposer.update({poll: undefined})}
      />
    </>
  )
}
