import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useDebouncedValue} from '#/lib/hooks/useDebouncedValue'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useSession} from '#/state/session'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {SearchInput} from '#/components/forms/SearchInput'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group3'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {CommunityCard} from './components/CommunityCard'
import {
  type CommunityView,
  flattenPages,
  useCommunitiesQuery,
  useMyCommunitiesQuery,
} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Communities'>

type Tab = 'discover' | 'mine'

/** Find communities to join, or open one of yours */
export function CommunitiesScreen({}: Props) {
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<Tab>(hasSession ? 'mine' : 'discover')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'popular' | 'new'>('popular')
  const query = useDebouncedValue(search, 300)

  const discover = useCommunitiesQuery({query, sort})
  const mine = useMyCommunitiesQuery()
  const active = tab === 'discover' ? discover : mine
  const items: CommunityView[] = flattenPages(active.data, 'communities')

  const header = (
    <View style={[a.px_xl, a.pt_md, a.pb_md, a.gap_md]}>
      {hasSession && (
        <SegmentedControl.Root
          label={l`Communities`}
          type="tabs"
          value={tab}
          onChange={setTab}>
          <SegmentedControl.Item value="mine" label={l`My communities`}>
            <SegmentedControl.ItemText>
              <Trans>Mine</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="discover" label={l`Discover`}>
            <SegmentedControl.ItemText>
              <Trans>Discover</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      )}
      {tab === 'discover' && (
        <>
          <SearchInput
            testID="communitySearch"
            label={l`Search communities`}
            value={search}
            onChangeText={setSearch}
            onClearText={() => setSearch('')}
          />
          <View style={[a.flex_row, a.gap_sm]}>
            <Button
              label={sort === 'popular' ? l`Popular, selected` : l`Popular`}
              color={sort === 'popular' ? 'primary_subtle' : 'secondary'}
              size="small"
              onPress={() => setSort('popular')}>
              <ButtonText>
                <Trans>Popular</Trans>
              </ButtonText>
            </Button>
            <Button
              label={sort === 'new' ? l`Newest, selected` : l`Newest`}
              color={sort === 'new' ? 'primary_subtle' : 'secondary'}
              size="small"
              onPress={() => setSort('new')}>
              <ButtonText>
                <Trans>Newest</Trans>
              </ButtonText>
            </Button>
          </View>
        </>
      )}
    </View>
  )

  return (
    <Layout.Screen testID="communitiesScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Communities</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          {hasSession && (
            <Button
              testID="createCommunityButton"
              label={l`Create a community`}
              color="primary"
              size="small"
              onPress={() => navigation.navigate('CommunityCreate')}>
              <ButtonIcon icon={PlusIcon} />
              <ButtonText>
                <Trans>Create</Trans>
              </ButtonText>
            </Button>
          )}
        </Layout.Header.Slot>
      </Layout.Header.Outer>
      <List
        data={items}
        keyExtractor={(item: CommunityView) => item.uri}
        renderItem={({item, index}: {item: CommunityView; index: number}) => (
          <CommunityCard community={item} hideTopBorder={index === 0} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          active.isLoading ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : active.isError ? (
            <View style={[a.p_xl, a.gap_md]}>
              <Admonition type="error">{cleanError(active.error)}</Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void active.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <EmptyInvite tab={tab} searching={!!query.trim()} />
          )
        }
        ListFooterComponent={
          items.length > 0 ? (
            <ListFooter
              isFetchingNextPage={active.isFetchingNextPage}
              hasNextPage={active.hasNextPage}
              error={active.isError ? cleanError(active.error) : undefined}
              onRetry={() => active.fetchNextPage()}
              height={120}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (active.hasNextPage && !active.isFetchingNextPage) {
            void active.fetchNextPage()
          }
        }}
        onEndReachedThreshold={2}
        refreshing={active.isRefetching && !active.isFetchingNextPage}
        onRefresh={() => void active.refetch()}
        sideBorders={false}
      />
    </Layout.Screen>
  )
}

/** An empty list is an invitation, not a dead end */
function EmptyInvite({tab, searching}: {tab: Tab; searching: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {hasSession} = useSession()
  return (
    <View style={[a.p_xl, a.pt_3xl, a.align_center, a.gap_md]}>
      <GroupIcon size="xl" fill={t.atoms.text_contrast_low.color} />
      <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
        {searching ? (
          <Trans>No communities match your search</Trans>
        ) : tab === 'mine' ? (
          <Trans>You haven’t joined a community yet</Trans>
        ) : (
          <Trans>No communities yet</Trans>
        )}
      </Text>
      <Text
        style={[
          a.text_md,
          a.text_center,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {tab === 'mine' ? (
          <Trans>Join one from Discover, or start your own.</Trans>
        ) : (
          <Trans>
            Be the first: start a community around what you care about.
          </Trans>
        )}
      </Text>
      {hasSession && (
        <Button
          label={l`Create a community`}
          color="primary"
          size="large"
          onPress={() => navigation.navigate('CommunityCreate')}>
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>Create a community</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )
}
