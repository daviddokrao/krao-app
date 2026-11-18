import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {Window_Stroke2_Corner2_Rounded as AppIcon} from '#/components/icons/Window'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {MiniAppCard} from './components/MiniAppCard'
import {type MiniAppView} from './logic'
import {useApprovedAppsQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MiniApps'>

/** The Mini Apps Krao has approved, to open or to share in a post */
export function MiniAppsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const query = useApprovedAppsQuery()
  const apps: MiniAppView[] = query.data?.pages.flatMap(page => page.apps) ?? []

  const header = (
    <View style={[a.px_xl, a.pt_md, a.pb_md]}>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Small apps that run inside Krao. Krao reviews each one, and you decide
          what it may do. Nothing is signed or sent without showing you first.
        </Trans>
      </Text>
    </View>
  )

  return (
    <Layout.Screen testID="miniAppsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Mini Apps</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <List
        data={apps}
        keyExtractor={(item: MiniAppView) => item.uri}
        renderItem={({item, index}: {item: MiniAppView; index: number}) => (
          <MiniAppCard app={item} hideTopBorder={index === 0} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : query.isError ? (
            <View style={[a.p_xl, a.gap_md]}>
              <Admonition type="error">{cleanError(query.error)}</Admonition>
              <Button
                label={l`Try again`}
                color="secondary"
                size="small"
                style={[a.self_start]}
                onPress={() => void query.refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <View style={[a.p_xl, a.pt_3xl, a.align_center, a.gap_md]}>
              <AppIcon size="xl" fill={t.atoms.text_contrast_low.color} />
              <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
                <Trans>No Mini Apps yet</Trans>
              </Text>
              <Text
                style={[
                  a.text_md,
                  a.text_center,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>Approved Mini Apps will show up here.</Trans>
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          apps.length > 0 ? (
            <ListFooter
              isFetchingNextPage={query.isFetchingNextPage}
              hasNextPage={query.hasNextPage}
              error={query.isError ? cleanError(query.error) : undefined}
              onRetry={() => query.fetchNextPage()}
              height={120}
            />
          ) : undefined
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage()
          }
        }}
        onEndReachedThreshold={2}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        sideBorders={false}
      />
    </Layout.Screen>
  )
}
