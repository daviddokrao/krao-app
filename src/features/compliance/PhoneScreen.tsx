import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {PhoneVerifyForm} from './components/PhoneVerifyForm'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PhoneSettings'>

/** Settings > Account > Phone number */
export function PhoneScreen({}: Props) {
  const t = useTheme()
  return (
    <Layout.Screen testID="phoneScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Phone number</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_lg]}>
          <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
            <Trans>
              Krao asks every account to verify a phone number before posting or
              sending messages, as Vietnamese law requires. A phone number
              belongs to one account only. Krao does not show it to anyone.
            </Trans>
          </Text>
          <PhoneVerifyForm />
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}
