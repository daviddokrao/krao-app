import {View} from 'react-native'
// @ts-expect-error missing types
import QRCode from 'react-native-qrcode-styled'

import {atoms as a, useTheme} from '#/alf'
import {IS_WEB} from '#/env'

/** The join link as a QR code, for inviting someone in person */
export function ReferralQr({url}: {url: string}) {
  const t = useTheme()
  return (
    <View style={[a.align_center]}>
      <QRCode
        data={url}
        style={[
          a.rounded_sm,
          {height: 200, width: 200, backgroundColor: '#fff'},
        ]}
        pieceSize={IS_WEB ? 7 : 5}
        padding={16}
        pieceBorderRadius={IS_WEB ? 3.5 : 2.5}
        outerEyesOptions={{borderRadius: 10, color: t.palette.primary_500}}
        innerEyesOptions={{borderRadius: 4, color: t.palette.primary_500}}
        color="#000"
      />
    </View>
  )
}
