import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {Post} from '#/view/com/post/Post'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {flattenPages} from '#/features/community/queries'
import {PinFeedButton} from '#/features/growth/PinFeedButton'
import {Change} from './components/Change'
import {PriceChart} from './components/PriceChart'
import {TokenAvatar} from './components/TokenAvatar'
import {formatUsd, normalizeSymbol} from './logic'
import {
  type PriceRange,
  type TokenView,
  useTokenFeedQuery,
  useTokenQuery,
} from './queries'

type PostView = Parameters<typeof Post>[0]['post']

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Token'>

export function TokenScreen({route}: Props) {
  const symbol = normalizeSymbol(route.params.symbol)
  const {t: l} = useLingui()
  const token = useTokenQuery(symbol)

  return (
    <Layout.Screen testID="tokenScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{`$${symbol}`}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {token.data ? (
        <TokenBody token={token.data} />
      ) : token.isError ? (
        <View style={[a.p_xl, a.gap_md]}>
          <Admonition type="error">
            {token.error && 'error' in token.error
              ? token.error.error === 'NotFound'
                ? l`This token isn’t listed on Krao.`
                : cleanError(token.error)
              : cleanError(token.error)}
          </Admonition>
          <Button
            label={l`Try again`}
            color="secondary"
            size="small"
            style={[a.self_start]}
            onPress={() => void token.refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <View style={[a.p_xl, a.align_center]}>
          <Loader size="xl" />
        </View>
      )}
    </Layout.Screen>
  )
}

function TokenBody({token}: {token: TokenView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {symbol} = token
  const feed = useTokenFeedQuery(symbol)
  const posts = flattenPages(feed.data, 'posts')

  const header = (
    <View>
      <TokenHeader token={token} />
      <View
        style={[
          a.px_xl,
          a.pt_md,
          a.pb_lg,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <Text style={[a.text_lg, a.font_semi_bold]}>
          <Trans>Posts mentioning ${symbol}</Trans>
        </Text>
      </View>
    </View>
  )

  return (
    <List
      data={posts}
      keyExtractor={(post: PostView) => post.uri}
      renderItem={({item, index}: {item: PostView; index: number}) => (
        <Post post={item} hideTopBorder={index === 0} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        feed.isLoading ? (
          <View style={[a.p_xl, a.align_center]}>
            <Loader size="xl" />
          </View>
        ) : feed.isError ? (
          <View style={[a.p_xl, a.gap_md]}>
            <Admonition type="error">{cleanError(feed.error)}</Admonition>
            <Button
              label={l`Try again`}
              color="secondary"
              size="small"
              style={[a.self_start]}
              onPress={() => void feed.refetch()}>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          </View>
        ) : (
          <View style={[a.p_xl, a.pt_2xl, a.align_center, a.gap_sm]}>
            <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
              <Trans>No posts yet</Trans>
            </Text>
            <Text
              style={[
                a.text_md,
                a.text_center,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Posts that mention ${symbol} will show up here.</Trans>
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        posts.length > 0 ? (
          <ListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            hasNextPage={feed.hasNextPage}
            error={feed.isError ? cleanError(feed.error) : undefined}
            onRetry={() => feed.fetchNextPage()}
            height={120}
          />
        ) : undefined
      }
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage()
        }
      }}
      onEndReachedThreshold={2}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => void feed.refetch()}
      sideBorders={false}
    />
  )
}

function TokenHeader({token}: {token: TokenView}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [range, setRange] = useState<PriceRange>('7d')
  const price = formatUsd(token.priceUsd)

  return (
    <View style={[a.px_xl, a.pt_lg, a.pb_md, a.gap_lg]}>
      <View style={[a.flex_row, a.gap_md, a.align_center]}>
        <TokenAvatar symbol={token.symbol} logo={token.logo} size={56} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji style={[a.text_2xl, a.font_bold, a.leading_tight]}>
            {token.name}
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {`$${token.symbol}`}
          </Text>
        </View>
        <View style={[a.align_end, a.gap_2xs]}>
          <Text testID="tokenPrice" style={[a.text_xl, a.font_bold]}>
            {price ?? <Trans>No price yet</Trans>}
          </Text>
          <Change
            value={token.change24h}
            style={[a.text_sm, a.font_semi_bold]}
          />
        </View>
      </View>

      <SegmentedControl.Root
        label={l`Chart period`}
        type="tabs"
        value={range}
        onChange={setRange}>
        <SegmentedControl.Item value="1d" label={l`1 day`}>
          <SegmentedControl.ItemText>
            <Trans>1D</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="7d" label={l`7 days`}>
          <SegmentedControl.ItemText>
            <Trans>7D</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="30d" label={l`30 days`}>
          <SegmentedControl.ItemText>
            <Trans>30D</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      <PriceChart symbol={token.symbol} range={range} />

      {token.holderFeed ? (
        <PinFeedButton
          testID="pinHolderFeedButton"
          uri={token.holderFeed}
          size="large"
          pinLabel={l`Pin the $${token.symbol} holders feed`}
          unpinLabel={l`Unpin the $${token.symbol} holders feed`}
        />
      ) : null}

      <Text
        testID="tokenDisclaimer"
        style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Not financial advice. Prices come from on-chain pools and may be
          delayed.
        </Trans>
      </Text>
    </View>
  )
}
