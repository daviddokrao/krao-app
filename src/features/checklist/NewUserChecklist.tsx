import {useEffect} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {type NavigationProp} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {
  Circle_Stroke2_Corner0_Rounded as CircleIcon,
  CircleCheck_Stroke2_Corner0_Rounded as CircleCheckIcon,
} from '#/components/icons/Circle'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {CAN_CONNECT_WALLET} from '#/features/wallet/mode'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {account, useStorage} from '#/storage'
import {
  CHECKLIST_STEPS,
  type ChecklistStepId,
  detectSteps,
  FOLLOW_TARGET,
  isNewAccount,
  mergeDone,
  shouldShowChecklist,
} from './steps'

/**
 * Home feed header for a new account: five first steps (photo, follows, first
 * post, wallet, first tip), each ticked by itself once the account's data
 * shows it. Progress is remembered per account on this device; the card goes
 * away when everything is done or the user closes it.
 */
export function NewUserChecklist() {
  const {hasSession, currentAccount} = useSession()
  if (!hasSession || !currentAccount) return null
  return <Checklist did={currentAccount.did} handle={currentAccount.handle} />
}

function Checklist({did, handle}: {did: string; handle: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {openComposer} = useOpenComposer()
  const profile = useProfileQuery({did})
  const chain = useChainProfileQuery(did)
  const [stored, setStored] = useStorage(account, [did, 'kraoChecklist'])

  const detected = detectSteps({
    avatar: profile.data?.avatar,
    followsCount: profile.data?.followsCount,
    postsCount: profile.data?.postsCount,
    wallets: chain.data?.wallets,
    badges: chain.data?.badges,
  })
  const done = mergeDone(stored, detected)
  const profileReady = !!profile.data
  // A failed chain lookup must not hide the card for good
  const chainReady = !chain.isLoading
  const dismissed = !!stored?.dismissed
  const show = shouldShowChecklist({
    ready: profileReady && chainReady,
    dismissed,
    /*
     * Krao's appview does not return createdAt (it comes from the profile
     * record), so fall back to when the account was first indexed
     */
    newAccount: isNewAccount({
      createdAt: profile.data?.createdAt ?? profile.data?.indexedAt,
      postsCount: profile.data?.postsCount,
      followsCount: profile.data?.followsCount,
    }),
    done,
  })

  // Remember steps once they are done, so they stay ticked
  const doneKey = done.join(',')
  const storedKey = (stored?.done ?? []).join(',')
  useEffect(() => {
    if (profileReady && chainReady && doneKey !== storedKey) {
      setStored({...stored, done})
    }
    // setStored/stored/done change every render; the keys carry the content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileReady, chainReady, doneKey, storedKey])

  if (!show) return null

  const walletText = IS_WEB
    ? l`A wallet is a free app or browser extension that holds your tokens and signs for you. Krao never sees its keys. Install one such as MetaMask, then link it, or link one you already have.`
    : CAN_CONNECT_WALLET
      ? l`A wallet is a free app that holds your tokens and signs for you. Krao never sees its keys. Install one on this phone such as MetaMask, then link it, or link one you already have.`
      : l`A wallet is a free app that holds your tokens and signs for you. Krao never sees its keys. Install one such as MetaMask or Coinbase Wallet and link it from Krao on the web; linking in the mobile app is coming soon.`

  const steps: Record<
    ChecklistStepId,
    {title: string; text: string; action?: {label: string; onPress: () => void}}
  > = {
    avatar: {
      title: l`Add a profile photo`,
      text: l`A photo helps people recognise you.`,
      action: {
        label: l`Open your profile`,
        onPress: () => navigation.navigate('Profile', {name: handle}),
      },
    },
    follow: {
      title: l`Follow ${FOLLOW_TARGET} accounts`,
      text: l`Your Following feed fills up with posts from the people you follow.`,
      action: {
        label: l`Find accounts`,
        onPress: () => navigation.navigate('Search', {}),
      },
    },
    post: {
      title: l`Write your first post`,
      text: l`Say hello to the community.`,
      action: {
        label: l`Write a post`,
        onPress: () => openComposer({logContext: 'Other'}),
      },
    },
    wallet: {
      title: l`Link or create a wallet`,
      text: walletText,
      action: {
        label: l`Open wallets`,
        onPress: () => navigation.navigate('WalletsSettings'),
      },
    },
    tip: {
      title: l`Send your first tip`,
      text: l`Thank someone for a post with a small tip. It needs a linked wallet, and the person you tip needs one too.`,
    },
  }

  return (
    <View
      testID="newUserChecklist"
      style={[
        a.m_md,
        a.p_md,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            <Trans>Get started on Krao</Trans>
          </Text>
          <Text
            testID="newUserChecklistProgress"
            style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              {done.length} of {CHECKLIST_STEPS.length} done
            </Trans>
          </Text>
        </View>
        <Button
          testID="newUserChecklistDismiss"
          label={l`Close the checklist`}
          accessibilityHint={l`Hides these first steps for good`}
          size="small"
          shape="round"
          color="secondary"
          variant="ghost"
          onPress={() => setStored({...stored, done, dismissed: true})}>
          <XIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        </Button>
      </View>
      {CHECKLIST_STEPS.map(id => {
        const isDone = done.includes(id)
        const step = steps[id]
        const Icon = isDone ? CircleCheckIcon : CircleIcon
        return (
          <View
            key={id}
            testID={`newUserChecklistStep-${id}`}
            accessibilityState={{checked: isDone}}
            style={[a.flex_row, a.gap_sm, a.align_start]}>
            <Icon
              size="md"
              fill={
                isDone
                  ? t.palette.positive_500
                  : t.atoms.text_contrast_low.color
              }
            />
            <View style={[a.flex_1, a.gap_xs]}>
              <Text
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  a.leading_snug,
                  isDone && t.atoms.text_contrast_medium,
                  isDone && {textDecorationLine: 'line-through'},
                ]}>
                {step.title}
              </Text>
              {!isDone && (
                <>
                  <Text
                    style={[
                      a.text_sm,
                      a.leading_snug,
                      t.atoms.text_contrast_medium,
                    ]}>
                    {step.text}
                  </Text>
                  {step.action && (
                    <View style={[a.flex_row]}>
                      <Button
                        testID={`newUserChecklistAction-${id}`}
                        label={step.action.label}
                        size="small"
                        color="secondary"
                        onPress={step.action.onPress}>
                        <ButtonText>{step.action.label}</ButtonText>
                      </Button>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
