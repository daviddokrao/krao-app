import {useEffect, useImperativeHandle, useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {Image} from 'expo-image'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {cleanError} from '#/lib/strings/errors'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfilesQuery} from '#/state/queries/profile'
import {List, type ListRef} from '#/view/com/util/List'
import {findListNativeTag} from '#/view/com/util/listNativeTag'
import {type SectionRef} from '#/screens/Profile/Sections/types'
import {CopyButton} from '#/screens/Settings/components/CopyButton'
import {atoms as a, ios, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldCheckIcon} from '#/components/icons/Shield'
import {Link} from '#/components/Link'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {formatUsd} from '#/features/token/logic'
import {shortAddress} from '#/features/wallet/primaryName'
import type * as bsky from '#/types/bsky'
import {
  counterpartyDid,
  formatSupportAmount,
  mergeSupportPages,
  nftKey,
  nftTitle,
  type OnchainNft,
  type OnchainProfile,
  type OnchainWallet,
  type SupportDirection,
  type SupportItem,
} from './logic'
import {useSupportHistoryQuery} from './queries'

type Row =
  | {type: 'summary'}
  | {type: 'filter'}
  | {type: 'loading'}
  | {type: 'error'}
  | {type: 'empty'}
  | {type: 'item'; item: SupportItem}

const NFT_SIZE = 104

/**
 * The "On-chain" tab of a profile: the verified Basename/ENS name, linked
 * wallets, approved NFTs and what the account has given and received through
 * tips and memberships (only verified, never anonymous ones).
 */
export function ProfileOnchainSection({
  ref,
  did,
  onchain,
  scrollElRef,
  headerOffset,
  enabled,
  setScrollViewTag,
}: {
  ref?: React.Ref<SectionRef>
  did: string
  onchain: OnchainProfile
  scrollElRef: ListRef
  headerOffset: number
  enabled?: boolean
  setScrollViewTag: (tag: number | null) => void
}) {
  const {t: l} = useLingui()
  const {height} = useWindowDimensions()
  const queryClient = useQueryClient()
  const [direction, setDirection] = useState<SupportDirection>('received')
  const history = useSupportHistoryQuery(did, direction, {enabled})
  const items = mergeSupportPages(history.data?.pages)
  const [isPTRing, setIsPTRing] = useState(false)

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      scrollElRef.current?.scrollToOffset({
        animated: true,
        offset: -headerOffset,
      })
      void queryClient.invalidateQueries({queryKey: ['krao-onchain']})
    },
  }))

  useEffect(() => {
    if (IS_IOS && enabled && scrollElRef.current) {
      setScrollViewTag(findListNativeTag(scrollElRef.current))
    }
  }, [enabled, scrollElRef, setScrollViewTag])

  const rows: Row[] = [{type: 'summary'}, {type: 'filter'}]
  if (history.isPending) rows.push({type: 'loading'})
  else if (history.isError && !items.length) rows.push({type: 'error'})
  else if (!items.length) rows.push({type: 'empty'})
  else rows.push(...items.map(item => ({type: 'item' as const, item})))

  const dids = items.map(item => counterpartyDid(item, direction))
  const {data: profiles} = useProfilesQuery({
    handles: [...new Set(dids)].slice(0, 25),
  })
  const byDid = new Map<string, bsky.profile.AnyProfileView>(
    profiles?.profiles.map(p => [p.did, p]),
  )

  return (
    <List
      ref={scrollElRef}
      data={rows}
      keyExtractor={(row: Row) =>
        row.type === 'item' ? row.item.uri : row.type
      }
      renderItem={({item: row}: {item: Row}) => {
        switch (row.type) {
          case 'summary':
            return <Overview onchain={onchain} />
          case 'filter':
            return <DirectionFilter value={direction} onChange={setDirection} />
          case 'loading':
            return (
              <View style={[a.p_xl, a.align_center]}>
                <Loader size="xl" />
              </View>
            )
          case 'error':
            return (
              <View style={[a.p_xl, a.gap_md]}>
                <Admonition type="error">
                  {cleanError(history.error)}
                </Admonition>
                <Button
                  label={l`Try again`}
                  color="secondary"
                  size="small"
                  style={[a.self_start]}
                  onPress={() => void history.refetch()}>
                  <ButtonText>
                    <Trans>Try again</Trans>
                  </ButtonText>
                </Button>
              </View>
            )
          case 'empty':
            return <EmptyHistory direction={direction} />
          case 'item':
            return (
              <SupportRow
                item={row.item}
                direction={direction}
                profile={byDid.get(counterpartyDid(row.item, direction))}
              />
            )
        }
      }}
      ListFooterComponent={
        items.length > 0 ? (
          <ListFooter
            hasNextPage={history.hasNextPage}
            isFetchingNextPage={history.isFetchingNextPage}
            onRetry={() => history.fetchNextPage()}
            error={history.isError ? cleanError(history.error) : undefined}
            height={180 + headerOffset}
          />
        ) : undefined
      }
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage) {
          void history.fetchNextPage()
        }
      }}
      refreshing={isPTRing}
      onRefresh={() => {
        setIsPTRing(true)
        void queryClient
          .invalidateQueries({queryKey: ['krao-onchain']})
          .finally(() => setIsPTRing(false))
      }}
      headerOffset={headerOffset}
      progressViewOffset={ios(0)}
      desktopFixedHeight
      contentContainerStyle={{minHeight: height + headerOffset}}
    />
  )
}

function Overview({onchain}: {onchain: OnchainProfile}) {
  return (
    <View style={[a.px_lg, a.pt_lg, a.gap_xl]}>
      <SupportTotals support={onchain.support} />
      {onchain.primaryName && (
        <PrimaryNameLine primaryName={onchain.primaryName} />
      )}
      {onchain.wallets.length > 0 && <Wallets wallets={onchain.wallets} />}
      {onchain.nfts.length > 0 && <NftGrid nfts={onchain.nfts} />}
    </View>
  )
}

function SectionTitleText({children}: {children: React.ReactNode}) {
  return (
    <Text accessibilityRole="header" style={[a.text_lg, a.font_bold]}>
      {children}
    </Text>
  )
}

function SupportTotals({support}: {support: OnchainProfile['support']}) {
  const {t: l} = useLingui()
  const received = formatUsd(support.tipsReceivedUsd) ?? '$0.00'
  const sent = formatUsd(support.tipsSentUsd) ?? '$0.00'
  const receivedCount = plural(support.tipsReceived, {
    one: '# tip',
    other: '# tips',
  })
  const sentCount = plural(support.tipsSent, {one: '# tip', other: '# tips'})
  const members = plural(support.membersActive, {
    one: '# active member',
    other: '# active members',
  })
  const memberships = plural(support.membershipsActive, {
    one: '# active membership',
    other: '# active memberships',
  })
  return (
    <View style={[a.gap_md]}>
      <SectionTitleText>
        <Trans>Support</Trans>
      </SectionTitleText>
      <View style={[a.flex_row, a.gap_md]}>
        <StatCard
          testID="onchainTipsReceived"
          label={l`Received`}
          value={received}
          detail={receivedCount}
        />
        <StatCard
          testID="onchainTipsSent"
          label={l`Sent`}
          value={sent}
          detail={sentCount}
        />
      </View>
      {(support.membersActive > 0 || support.membershipsActive > 0) && (
        <Text style={[a.text_sm, a.leading_snug]}>
          {[
            support.membersActive > 0 ? members : null,
            support.membershipsActive > 0 ? memberships : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
    </View>
  )
}

function StatCard({
  label,
  value,
  detail,
  testID,
}: {
  label: string
  value: string
  detail: string
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}, ${detail}`}
      accessibilityHint=""
      style={[
        a.flex_1,
        a.p_md,
        a.gap_2xs,
        a.rounded_md,
        t.atoms.bg_contrast_25,
      ]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[a.text_2xl, a.font_bold]}>{value}</Text>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>{detail}</Text>
    </View>
  )
}

function PrimaryNameLine({
  primaryName,
}: {
  primaryName: NonNullable<OnchainProfile['primaryName']>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      accessible
      accessibilityLabel={l`${primaryName.name}, a name that points to a wallet verified for this account`}
      accessibilityHint=""
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <ShieldCheckIcon size="md" fill={t.palette.primary_500} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          emoji
          selectable
          numberOfLines={1}
          style={[a.text_lg, a.font_semi_bold]}>
          {primaryName.name}
        </Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {primaryName.source === 'basename' ? (
            <Trans>Basename</Trans>
          ) : (
            <Trans>ENS</Trans>
          )}
          {' · '}
          {shortAddress(primaryName.address)}
        </Text>
      </View>
    </View>
  )
}

/** "eip155:8453" as people know it */
function useChainName() {
  const {t: l} = useLingui()
  return (chain: string) =>
    chain === 'eip155:8453' ? l`Base` : chain.replace(/^eip155:/, 'Chain ')
}

function Wallets({wallets}: {wallets: OnchainWallet[]}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const chainName = useChainName()
  return (
    <View style={[a.gap_sm]}>
      <SectionTitleText>
        <Trans>Wallets</Trans>
      </SectionTitleText>
      <View style={[a.gap_xs]} accessibilityRole="list">
        {wallets.map(wallet => (
          <View
            key={`${wallet.chain}:${wallet.address}`}
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.p_md,
              a.rounded_md,
              t.atoms.bg_contrast_25,
            ]}>
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_md, a.font_semi_bold]}>
                {wallet.label || chainName(wallet.chain)}
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {chainName(wallet.chain)}
                {' · '}
                {shortAddress(wallet.address)}
              </Text>
            </View>
            <CopyButton
              value={wallet.address}
              label={l`Copy wallet address ${shortAddress(wallet.address)}`}
              color="secondary"
              size="small"
              style={[a.justify_center]}>
              <ButtonText>
                <Trans>Copy</Trans>
              </ButtonText>
            </CopyButton>
          </View>
        ))}
      </View>
    </View>
  )
}

function NftGrid({nfts}: {nfts: OnchainNft[]}) {
  return (
    <View style={[a.gap_sm]}>
      <SectionTitleText>
        <Trans>NFTs</Trans>
      </SectionTitleText>
      <View
        style={[a.flex_row, a.flex_wrap, a.gap_md]}
        accessibilityRole="list">
        {nfts.map(nft => (
          <NftCard key={nftKey(nft)} nft={nft} />
        ))}
      </View>
    </View>
  )
}

function NftCard({nft}: {nft: OnchainNft}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const title = nftTitle(nft)
  const count = Number(nft.balance)
  const showCount = Number.isFinite(count) && count > 1
  const label = nft.isAvatar
    ? l`${title}, your profile picture`
    : showCount
      ? l`${title}, ${count} owned`
      : title
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityHint=""
      style={[a.gap_xs, {width: NFT_SIZE}]}>
      <View
        style={[
          a.rounded_md,
          a.overflow_hidden,
          t.atoms.bg_contrast_100,
          {width: NFT_SIZE, height: NFT_SIZE},
        ]}>
        {nft.image ? (
          <Image
            source={{uri: nft.image}}
            style={[{width: NFT_SIZE, height: NFT_SIZE}]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        ) : (
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
            <Text style={[a.text_2xl, t.atoms.text_contrast_medium]}>⬡</Text>
          </View>
        )}
        {nft.isAvatar && (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.px_sm,
              a.py_2xs,
              {
                top: 6,
                left: 6,
                backgroundColor: t.palette.primary_500,
              },
            ]}>
            <Text style={[a.text_xs, a.font_semi_bold, {color: '#fff'}]}>
              <Trans>Avatar</Trans>
            </Text>
          </View>
        )}
        {showCount && (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.px_sm,
              a.py_2xs,
              {bottom: 6, right: 6, backgroundColor: t.palette.black},
            ]}>
            <Text style={[a.text_xs, a.font_semi_bold, {color: '#fff'}]}>
              {`x${count}`}
            </Text>
          </View>
        )}
      </View>
      <Text emoji numberOfLines={2} style={[a.text_sm, a.leading_snug]}>
        {title}
      </Text>
    </View>
  )
}

function DirectionFilter({
  value,
  onChange,
}: {
  value: SupportDirection
  onChange: (value: SupportDirection) => void
}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.px_lg, a.pt_xl, a.pb_md, a.gap_md]}>
      <SectionTitleText>
        <Trans>Support history</Trans>
      </SectionTitleText>
      <SegmentedControl.Root
        label={l`Support history`}
        type="tabs"
        value={value}
        onChange={onChange}>
        <SegmentedControl.Item value="received" label={l`Received`}>
          <SegmentedControl.ItemText>
            <Trans>Received</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="sent" label={l`Sent`}>
          <SegmentedControl.ItemText>
            <Trans>Sent</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
    </View>
  )
}

function EmptyHistory({direction}: {direction: SupportDirection}) {
  const t = useTheme()
  return (
    <View style={[a.px_xl, a.py_2xl, a.align_center]}>
      <Text
        style={[
          a.text_md,
          a.text_center,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {direction === 'sent' ? (
          <Trans>No tips or memberships sent yet.</Trans>
        ) : (
          <Trans>No tips or memberships received yet.</Trans>
        )}
      </Text>
    </View>
  )
}

function SupportRow({
  item,
  direction,
  profile,
}: {
  item: SupportItem
  direction: SupportDirection
  profile: bsky.profile.AnyProfileView | undefined
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const did = counterpartyDid(item, direction)
  const name = profile
    ? sanitizeDisplayName(profile.displayName || sanitizeHandle(profile.handle))
    : did
  const amount = formatSupportAmount(item)
  const usd = item.usd ? formatUsd(item.usd) : null
  const kind = item.kind === 'membership' ? l`Membership` : l`Tip`
  const date = i18n.date(new Date(item.createdAt), {dateStyle: 'medium'})
  const who = direction === 'sent' ? l`To ${name}` : l`From ${name}`
  const label = `${kind}. ${who}, ${amount}${usd ? ` (${usd})` : ''}, ${date}`

  const content = (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
          {who}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {kind}
          {' · '}
          {date}
        </Text>
      </View>
      <View style={[a.align_end, a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>{amount}</Text>
        {usd && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>{usd}</Text>
        )}
      </View>
    </View>
  )

  if (!profile) {
    return (
      <View accessible accessibilityLabel={label} accessibilityHint="">
        {content}
      </View>
    )
  }
  return (
    <Link
      to={makeProfileLink({did: profile.did, handle: profile.handle})}
      label={label}
      accessibilityHint={l`Opens their profile`}>
      {content}
    </Link>
  )
}
