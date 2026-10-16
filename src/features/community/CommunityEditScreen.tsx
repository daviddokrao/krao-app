import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useDescribeCondition} from '#/features/gating/describe'
import {
  type GateCondition,
  type NftHoldingCondition,
  type TokenBalanceCondition,
} from '#/features/gating/queries'
import {parseUnits, TIP_ASSETS, type TipAsset} from '#/features/tips/assets'
import {useAccessText} from './components/accessText'
import {Choice} from './components/Choice'
import {
  ACCESS_MODES,
  type AccessMode,
  type CommunityDraft,
  CONDITIONS_MAX,
  isOwner,
  makeCommunityUri,
  NAME_MAX,
  RULE_MAX,
  RULES_MAX,
  SLUG_MAX,
  slugify,
  validateCommunityDraft,
} from './logic'
import {
  type CommunityView,
  useCommunityQuery,
  useSaveCommunityMutation,
} from './queries'

type CreateProps = NativeStackScreenProps<
  CommonNavigatorParams,
  'CommunityCreate'
>
type EditProps = NativeStackScreenProps<CommonNavigatorParams, 'CommunityEdit'>

/** Start a community */
export function CommunityCreateScreen({}: CreateProps) {
  const {t: l} = useLingui()
  return (
    <Layout.Screen testID="communityCreateScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Create a community</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <CommunityForm label={l`Create community`} />
      </Layout.Content>
    </Layout.Screen>
  )
}

/** Edit a community (its owner only) */
export function CommunityEditScreen({route}: EditProps) {
  const {name, slug} = route.params
  const resolved = useResolveDidQuery(name)
  const uri = resolved.data ? makeCommunityUri(resolved.data, slug) : undefined
  const community = useCommunityQuery(uri)
  const {t: l} = useLingui()
  return (
    <Layout.Screen testID="communityEditScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Edit community</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {community.data ? (
          isOwner(community.data.viewer) ? (
            <CommunityForm community={community.data} label={l`Save changes`} />
          ) : (
            <View style={[a.p_xl]}>
              <Admonition type="error">
                <Trans>Only the owner can edit this community.</Trans>
              </Admonition>
            </View>
          )
        ) : community.isError ? (
          <View style={[a.p_xl]}>
            <Admonition type="error">{cleanError(community.error)}</Admonition>
          </View>
        ) : (
          <View style={[a.p_xl, a.align_center]}>
            <Loader size="xl" />
          </View>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

function draftFromCommunity(community?: CommunityView): CommunityDraft {
  if (!community) {
    return {
      name: '',
      slug: '',
      rulesText: '',
      mode: 'open',
      conditions: [],
      match: 'all',
      chatJoinLink: '',
    }
  }
  const access = community.access
  return {
    name: community.name,
    slug: community.slug,
    rulesText: community.rules.join('\n'),
    mode: access.mode as AccessMode,
    conditions: (access.conditions ?? []) as GateCondition[],
    match: access.match === 'any' ? 'any' : 'all',
    chatJoinLink: community.chatJoinLink ?? '',
  }
}

function CommunityForm({
  community,
  label,
}: {
  community?: CommunityView
  label: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accessText = useAccessText()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const save = useSaveCommunityMutation()
  const isNew = !community
  const [draft, setDraft] = useState(() => draftFromCommunity(community))
  const [slugTouched, setSlugTouched] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const problems = validateCommunityDraft(draft, {isNew})
  const patch = (next: Partial<CommunityDraft>) =>
    setDraft(prev => ({...prev, ...next}))

  const onSave = () => {
    if (problems.length > 0) {
      setShowProblems(true)
      return
    }
    save.mutate(
      {draft, existingUri: community?.uri},
      {
        onSuccess: () => {
          Toast.show(isNew ? l`Community created` : l`Community saved`, {
            type: 'success',
          })
          navigation.replace('Community', {
            name: currentAccount?.handle ?? community?.owner ?? '',
            slug: draft.slug,
          })
        },
      },
    )
  }

  const problemText = (problem: (typeof problems)[number]) => {
    switch (problem) {
      case 'name':
        return l`Give your community a name (up to ${NAME_MAX} characters).`
      case 'slug':
        return l`The address needs 3 to ${SLUG_MAX} lowercase letters, numbers or dashes.`
      case 'rules':
        return l`Up to ${RULES_MAX} rules, each up to ${RULE_MAX} characters.`
      case 'conditions':
        return l`Add what people must hold, up to ${CONDITIONS_MAX} requirements.`
      case 'chatLink':
        return l`The chat link must start with https://`
    }
  }

  return (
    <View style={[a.p_xl, a.gap_xl]}>
      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Name</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={showProblems && problems.includes('name')}>
          <TextField.Input
            testID="communityNameInput"
            label={l`Community name`}
            value={draft.name}
            maxLength={NAME_MAX}
            onChangeText={value =>
              patch({
                name: value,
                ...(isNew && !slugTouched ? {slug: slugify(value)} : {}),
              })
            }
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Address</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={showProblems && problems.includes('slug')}>
          <TextField.Input
            testID="communitySlugInput"
            label={l`Community address`}
            value={draft.slug}
            maxLength={SLUG_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            editable={isNew}
            onChangeText={value => {
              setSlugTouched(true)
              patch({slug: value.toLowerCase()})
            }}
          />
        </TextField.Root>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {isNew ? (
            <Trans>
              Lowercase letters, numbers and dashes. It can’t be changed later.
            </Trans>
          ) : (
            <Trans>The address can’t be changed.</Trans>
          )}
        </Text>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Rules (one per line)</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={showProblems && problems.includes('rules')}>
          <TextField.Input
            testID="communityRulesInput"
            label={l`Community rules`}
            value={draft.rulesText}
            onChangeText={rulesText => patch({rulesText})}
            multiline
            numberOfLines={4}
          />
        </TextField.Root>
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Who can join</Trans>
        </TextField.LabelText>
        {ACCESS_MODES.map(mode => (
          <Choice
            key={mode}
            testID={`accessMode-${mode}`}
            selected={draft.mode === mode}
            title={accessText(mode).title}
            description={accessText(mode).description}
            onPress={() => patch({mode})}
          />
        ))}
        {draft.mode === 'condition' && (
          <ConditionsEditor
            conditions={draft.conditions}
            match={draft.match}
            onChange={(conditions, match) => patch({conditions, match})}
          />
        )}
        {(draft.mode === 'verified' || draft.mode === 'condition') && (
          <Admonition type="info">
            <Trans>
              Joining is a public record. Members will be told it can show that
              they are verified, or hold the token or NFT you ask for.
            </Trans>
          </Admonition>
        )}
      </View>

      <View style={[a.gap_sm]}>
        <TextField.LabelText>
          <Trans>Group chat link (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root
          isInvalid={showProblems && problems.includes('chatLink')}>
          <TextField.Input
            testID="communityChatLinkInput"
            label={l`Group chat link`}
            placeholder="https://"
            value={draft.chatJoinLink}
            onChangeText={chatJoinLink => patch({chatJoinLink})}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </TextField.Root>
      </View>

      {showProblems && problems.length > 0 && (
        <Admonition type="error">
          {problems.map(problem => problemText(problem)).join(' ')}
        </Admonition>
      )}
      {save.error && (
        <Admonition type="error">
          {isNew ? (
            <Trans>
              Could not create the community. The address may already be taken.
            </Trans>
          ) : (
            cleanError(save.error)
          )}
        </Admonition>
      )}

      <Button
        testID="saveCommunityButton"
        label={label}
        color="primary"
        size="large"
        disabled={save.isPending}
        onPress={onSave}>
        {save.isPending && <ButtonIcon icon={Loader} />}
        <ButtonText>{label}</ButtonText>
      </Button>
    </View>
  )
}

function ConditionsEditor({
  conditions,
  match,
  onChange,
}: {
  conditions: GateCondition[]
  match: 'all' | 'any'
  onChange: (conditions: GateCondition[], match: 'all' | 'any') => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const describe = useDescribeCondition()
  const [kind, setKind] = useState<'token' | 'nft'>('token')
  const [asset, setAsset] = useState<TipAsset>(TIP_ASSETS[1])
  const [minAmount, setMinAmount] = useState('10')
  const [contract, setContract] = useState('')

  const minUnits = parseUnits(minAmount, asset.decimals)
  const next: TokenBalanceCondition | NftHoldingCondition | null =
    kind === 'token'
      ? minUnits
        ? {
            $type: 'net.krao.gate.defs#tokenBalance',
            asset: asset.id,
            minAmount: minUnits.toString(),
          }
        : null
      : /^0x[0-9a-fA-F]{40}$/.test(contract.trim())
        ? {
            $type: 'net.krao.gate.defs#nftHolding',
            chain: 'eip155:8453',
            contract: contract.trim(),
          }
        : null

  return (
    <View style={[a.gap_md, a.p_md, a.rounded_md, t.atoms.bg_contrast_25]}>
      {conditions.map((condition, i) => (
        <View key={i} style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text style={[a.flex_1, a.text_md]}>{describe(condition)}</Text>
          <Button
            label={l`Remove requirement`}
            color="secondary"
            size="tiny"
            shape="round"
            onPress={() =>
              onChange(
                conditions.filter((_, j) => j !== i),
                match,
              )
            }>
            <ButtonIcon icon={XIcon} />
          </Button>
        </View>
      ))}
      {conditions.length > 1 && (
        <View style={[a.flex_row, a.gap_sm]}>
          <Button
            label={match === 'all' ? l`All of them, selected` : l`All of them`}
            color={match === 'all' ? 'primary_subtle' : 'secondary'}
            size="small"
            onPress={() => onChange(conditions, 'all')}>
            <ButtonText>
              <Trans>All of them</Trans>
            </ButtonText>
          </Button>
          <Button
            label={match === 'any' ? l`Any one, selected` : l`Any one`}
            color={match === 'any' ? 'primary_subtle' : 'secondary'}
            size="small"
            onPress={() => onChange(conditions, 'any')}>
            <ButtonText>
              <Trans>Any one</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
      {conditions.length < CONDITIONS_MAX && (
        <View style={[a.gap_sm]}>
          <View style={[a.flex_row, a.gap_sm]}>
            <Button
              label={
                kind === 'token' ? l`Token balance, selected` : l`Token balance`
              }
              color={kind === 'token' ? 'primary_subtle' : 'secondary'}
              size="small"
              onPress={() => setKind('token')}>
              <ButtonText>
                <Trans>Token balance</Trans>
              </ButtonText>
            </Button>
            <Button
              label={kind === 'nft' ? l`NFT holders, selected` : l`NFT holders`}
              color={kind === 'nft' ? 'primary_subtle' : 'secondary'}
              size="small"
              onPress={() => setKind('nft')}>
              <ButtonText>
                <Trans>NFT holders</Trans>
              </ButtonText>
            </Button>
          </View>
          {kind === 'token' ? (
            <>
              <View style={[a.flex_row, a.gap_sm]}>
                {TIP_ASSETS.map(option => (
                  <Button
                    key={option.id}
                    label={
                      option.id === asset.id
                        ? l`${option.symbol}, selected`
                        : option.symbol
                    }
                    color={
                      option.id === asset.id ? 'primary_subtle' : 'secondary'
                    }
                    size="small"
                    onPress={() => setAsset(option)}>
                    <ButtonText>{option.symbol}</ButtonText>
                  </Button>
                ))}
              </View>
              <TextField.Root isInvalid={!minUnits}>
                <TextField.Input
                  label={l`Minimum balance`}
                  value={minAmount}
                  onChangeText={setMinAmount}
                  keyboardType="decimal-pad"
                />
              </TextField.Root>
            </>
          ) : (
            <TextField.Root>
              <TextField.Input
                testID="communityNftContract"
                label={l`NFT contract on Base`}
                placeholder="0x…"
                value={contract}
                onChangeText={setContract}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          )}
          <Button
            testID="addConditionButton"
            label={l`Add requirement`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            disabled={!next}
            onPress={() => next && onChange([...conditions, next], match)}>
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans>Add requirement</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}
