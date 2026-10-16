import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useIsMutating} from '@tanstack/react-query'

import {type NavigationProp} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {AddressDisplay} from '#/features/safety/components/AddressDisplay'
import {useExpectedAddressQuery} from '#/features/safety/queries'
import {
  UnlinkedTipWalletError,
  useTipRecipientWallet,
} from '#/features/tips/queries'
import {
  WalletRejectedError,
  WalletUnavailableError,
} from '#/features/wallet/evm'
import {CAN_CONNECT_WALLET} from '#/features/wallet/mode'
import {useChainProfileQuery} from '#/features/wallet/queries'
import {formatUsdc, PERIOD_DAYS} from '../logic'
import {
  PaymentNotRecordedError,
  PlanChangedError,
  type PlanView,
  SUBSCRIBE_MUTATION_KEY,
  useSavePendingPaymentsMutation,
  useSubscribeMutation,
} from '../queries'
import {PlanCard} from './PlanCard'

/**
 * Pay for a plan, or renew it: USDC from the viewer's linked wallet to the
 * creator's, on Base. The same wallet flow as a tip.
 */
export function PayMembershipDialog({
  control,
  plan,
  creatorHandle,
  previousExpiresAt,
  openCount,
}: {
  control: Dialog.DialogControlProps
  plan: PlanView | undefined
  creatorHandle: string
  /** The current expiry when renewing */
  previousExpiresAt?: string
  /** Changes each time the dialog is opened, so it starts afresh */
  openCount: number
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Pay for a membership`}
        style={web({maxWidth: 440})}>
        {plan && (
          <PayInner
            key={openCount}
            control={control}
            plan={plan}
            creatorHandle={creatorHandle}
            previousExpiresAt={previousExpiresAt}
          />
        )}
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PayInner({
  control,
  plan,
  creatorHandle,
  previousExpiresAt,
}: {
  control: Dialog.DialogControlProps
  plan: PlanView
  creatorHandle: string
  previousExpiresAt?: string
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const creatorWallet = useTipRecipientWallet(plan.creator)
  const {
    data: myChainProfile,
    isLoading: isMyProfileLoading,
    isError: isMyProfileError,
  } = useChainProfileQuery(currentAccount?.did)
  const hasOwnWallet = !!myChainProfile?.wallets.some(
    w => w.status === 'verified' && w.account.startsWith('eip155:'),
  )
  const creatorAddress = creatorWallet.data?.split(':').pop()
  const addressCheck = useExpectedAddressQuery(creatorAddress, plan.creator)
  const addressSuspect =
    !!addressCheck.data &&
    (addressCheck.data.matchesExpected === false ||
      addressCheck.data.lookalikes.length > 0)
  const subscribe = useSubscribeMutation()
  const savePending = useSavePendingPaymentsMutation()
  /*
   * A payment started in an earlier opening of this dialog (closed while it
   * ran) is still going: paying again here could charge twice
   */
  const running = useIsMutating({mutationKey: SUBSCRIBE_MUTATION_KEY})
  const otherRunning = running > (subscribe.isPending ? 1 : 0)
  const [phase, setPhase] = useState<'paying' | 'confirming'>('paying')
  const price = formatUsdc(plan.priceUsdc)
  const renewing = !!previousExpiresAt

  const errorMessage = !subscribe.error
    ? null
    : subscribe.error instanceof WalletUnavailableError
      ? IS_WEB
        ? l`No Ethereum wallet was found in this browser.`
        : l`No wallet app was found on this phone.`
      : subscribe.error instanceof WalletRejectedError
        ? l`The request was cancelled in your wallet.`
        : subscribe.error instanceof PaymentNotRecordedError
          ? l`Your payment was sent, but it could not be saved to your account yet. Save it now: you will not be charged again.`
          : subscribe.error instanceof PlanChangedError
            ? l`This plan was changed or closed by @${creatorHandle}. Nothing was paid. Go back and check the plan again.`
            : subscribe.error instanceof UnlinkedTipWalletError
              ? l`Link this wallet to your account in Settings → Wallets before paying with it.`
              : l`Something went wrong with the payment. Please try again.`

  const onPay = () => {
    if (!creatorWallet.data || otherRunning) return
    setPhase('paying')
    subscribe.mutate(
      {
        plan,
        creatorAddress: creatorWallet.data,
        previousExpiresAt,
        onPhase: setPhase,
      },
      {
        onSuccess: ({confirmed}) =>
          control.close(() => {
            Toast.show(
              confirmed
                ? l`You’re now a member of @${creatorHandle}`
                : l`Payment sent. Your membership will show up in a moment.`,
              {type: 'success'},
            )
          }),
      },
    )
  }

  const onSavePending = () =>
    savePending.mutate(undefined, {
      onSuccess: () =>
        control.close(() => {
          Toast.show(
            l`Payment saved. Your membership will show up in a moment.`,
            {type: 'success'},
          )
        }),
    })

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          {renewing ? (
            <Trans>Renew your membership</Trans>
          ) : (
            <Trans>Become a member</Trans>
          )}
        </Text>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>
            You pay {price} USDC on Base straight from your wallet to @
            {creatorHandle}’s. Krao never holds your funds and takes no fee.
            Access lasts {PERIOD_DAYS} days and does not renew by itself.
          </Trans>
        </Text>
      </View>

      <PlanCard
        name={plan.name}
        description={plan.description}
        priceUsdc={plan.priceUsdc}
        perks={plan.perks}
        highlight
      />

      {creatorWallet.isLoading || isMyProfileLoading ? (
        <Loader />
      ) : !creatorWallet.data ? (
        <Admonition type="info">
          <Trans>
            @{creatorHandle} hasn’t linked a wallet, so they can’t receive
            payments right now.
          </Trans>
        </Admonition>
      ) : !CAN_CONNECT_WALLET ? (
        <Admonition type="info">
          <Trans>
            Paying from the mobile app is coming soon. Use Krao on the web for
            now.
          </Trans>
        </Admonition>
      ) : isMyProfileError ? (
        <Admonition type="error">
          <Trans>Couldn’t load your wallets. Please try again later.</Trans>
        </Admonition>
      ) : !hasOwnWallet ? (
        <View style={[a.gap_md]}>
          <Admonition type="info">
            <Trans>
              To pay, first link the wallet you will pay from to your account.
            </Trans>
          </Admonition>
          <Button
            label={l`Link a wallet`}
            color="primary"
            size="large"
            onPress={() =>
              control.close(() => {
                navigation.navigate('WalletsSettings')
              })
            }>
            <ButtonText>
              <Trans>Link a wallet</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <>
          <View style={[a.gap_xs]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>To wallet</Trans>
            </Text>
            <AddressDisplay address={creatorAddress ?? creatorWallet.data} />
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>
                Check the first 6 and last 4 characters (in color) against your
                own records.
              </Trans>
            </Text>
          </View>
          {addressSuspect && (
            <Admonition type="warning">
              <Trans>
                This address does not match the wallet Krao has verified for @
                {creatorHandle}, or another verified wallet looks very similar
                to it. Do not pay unless you are sure.
              </Trans>
            </Admonition>
          )}

          {previousExpiresAt && (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                Your current period ends on{' '}
                {i18n.date(new Date(previousExpiresAt), {dateStyle: 'medium'})}.
              </Trans>
            </Text>
          )}

          {errorMessage && <Admonition type="error">{errorMessage}</Admonition>}
          {savePending.error && (
            <Admonition type="error">
              <Trans>
                The payment could not be saved yet. Please try again.
              </Trans>
            </Admonition>
          )}

          {otherRunning && (
            <Admonition type="info">
              <Trans>
                A payment you started is still being sent or checked. Wait for
                it to finish before paying again.
              </Trans>
            </Admonition>
          )}

          {subscribe.error instanceof PaymentNotRecordedError ? (
            // The money already moved: only the record is left to save
            <Button
              testID="savePaymentButton"
              label={l`Save the payment`}
              color="primary"
              size="large"
              disabled={savePending.isPending}
              onPress={onSavePending}>
              {savePending.isPending && <ButtonIcon icon={Loader} />}
              <ButtonText>
                <Trans>Save the payment</Trans>
              </ButtonText>
            </Button>
          ) : (
            <>
              <Button
                testID="payMembershipButton"
                label={
                  renewing ? l`Renew for ${price} USDC` : l`Pay ${price} USDC`
                }
                color="primary"
                size="large"
                disabled={
                  subscribe.isPending ||
                  otherRunning ||
                  subscribe.error instanceof PlanChangedError
                }
                onPress={onPay}>
                {subscribe.isPending && <ButtonIcon icon={Loader} />}
                <ButtonText>
                  {subscribe.isPending ? (
                    phase === 'paying' ? (
                      <Trans>Confirm in your wallet…</Trans>
                    ) : (
                      <Trans>Confirming your payment…</Trans>
                    )
                  ) : renewing ? (
                    <Trans>Renew for {price} USDC</Trans>
                  ) : (
                    <Trans>Pay {price} USDC</Trans>
                  )}
                </ButtonText>
              </Button>
              {subscribe.isPending && phase === 'confirming' && (
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>
                    Your payment was sent. This takes a few seconds while Krao
                    checks it on the blockchain.
                  </Trans>
                </Text>
              )}
            </>
          )}
        </>
      )}
    </View>
  )
}
