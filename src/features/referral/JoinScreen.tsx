import {useEffect} from 'react'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {setPendingReferralCode} from './pendingCode'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Join'>

let handledCode: string | undefined

/**
 * krao.net/join/<referral code>: opens sign-up with the code filled in.
 * Signed in, there is nothing to join, so it leads to inviting others.
 */
export function JoinScreen({route}: Props) {
  const navigation = useNavigation<NavigationProp>()
  const {hasSession} = useSession()
  const {requestSwitchToAccount} = useLoggedOutViewControls()
  const {code} = route.params

  useEffect(() => {
    /*
     * Once per link: the screen remounts under Home (eg when the sign-up
     * view closes on web) and must not reopen sign-up
     */
    if (handledCode === code) {
      // Opened again (the same link twice): leave instead of spinning here
      navigation.navigate('Home')
      return
    }
    handledCode = code
    if (hasSession) {
      navigation.navigate('ReferralSettings')
      return
    }
    setPendingReferralCode(code)
    requestSwitchToAccount({requestedAccount: 'new'})
    navigation.navigate('Home')
  }, [code, hasSession, navigation, requestSwitchToAccount])

  return (
    <Layout.Screen>
      <Layout.Content contentContainerStyle={[a.align_center, a.py_5xl]}>
        <Loader size="xl" />
      </Layout.Content>
    </Layout.Screen>
  )
}
