import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {containsSecret} from '#/features/safety/guard'
import {Choice} from '../components/Choice'
import {canPostTo} from '../logic'
import {flattenPages, useMyCommunitiesQuery} from '../queries'
import {kraoComposer, useKraoComposerState} from './store'

/**
 * Picks the community a post goes into, and optionally text only its
 * members can read.
 */
export function CommunityPickerDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Post to a community`}
        style={web({maxWidth: 480})}>
        <PickerInner control={control} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PickerInner({control}: {control: Dialog.DialogControlProps}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const state = useKraoComposerState()
  const mine = useMyCommunitiesQuery()
  const [text, setText] = useState(state.memberOnlyText)
  const hasSecret = containsSecret(text)
  const communities = flattenPages(mine.data, 'communities').filter(c =>
    canPostTo(c.viewer),
  )

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Post to a community</Trans>
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            The post shows in the community’s feed. It stays a normal post on
            your profile too.
          </Trans>
        </Text>
      </View>

      {mine.isLoading ? (
        <Loader />
      ) : mine.isError ? (
        <Admonition type="error">
          <Trans>Could not load your communities.</Trans>
        </Admonition>
      ) : communities.length === 0 ? (
        <Admonition type="info">
          <Trans>
            You haven’t joined a community yet. Find one under Communities in
            the menu.
          </Trans>
        </Admonition>
      ) : (
        <View style={[a.gap_sm]}>
          <Choice
            testID="communityNone"
            selected={!state.community}
            title={l`No community`}
            onPress={() => kraoComposer.setCommunity(undefined)}
          />
          {communities.map(c => (
            <Choice
              key={c.uri}
              testID={`communityOption-${c.slug}`}
              selected={state.community?.uri === c.uri}
              title={c.name}
              onPress={() =>
                kraoComposer.setCommunity({
                  uri: c.uri,
                  name: c.name,
                  slug: c.slug,
                })
              }
            />
          ))}
        </View>
      )}

      {state.community && (
        <View style={[a.gap_sm]}>
          <Choice
            testID="communityMemberOnly"
            selected={state.memberOnly}
            title={l`Add text only members can read`}
            description={l`Your post stays visible as a teaser. The extra text is kept on Krao’s gate service and shown only to members.`}
            onPress={() => kraoComposer.update({memberOnly: !state.memberOnly})}
          />
          {state.memberOnly && (
            <>
              <TextField.Root>
                <TextField.Input
                  testID="memberOnlyText"
                  label={l`Members-only text`}
                  placeholder={l`What only members should see`}
                  value={text}
                  onChangeText={value => {
                    setText(value)
                    kraoComposer.update({memberOnlyText: value})
                  }}
                  multiline
                  numberOfLines={4}
                  maxLength={3000}
                />
              </TextField.Root>
              {hasSecret && (
                <Admonition type="error">
                  <Trans>
                    This text looks like it has a seed phrase or private key.
                    Remove it first.
                  </Trans>
                </Admonition>
              )}
            </>
          )}
        </View>
      )}

      <Button
        testID="communityPickerDone"
        label={l`Done`}
        color="primary"
        size="large"
        onPress={() => control.close()}>
        <ButtonText>
          <Trans>Done</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
