import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Text} from '#/components/Typography'

/** A selectable row: a title, a line of explanation, and a check when chosen */
export function Choice({
  selected,
  title,
  description,
  onPress,
  disabled,
  testID,
}: {
  selected: boolean
  title: string
  description?: string
  onPress: () => void
  disabled?: boolean
  testID?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Button
      testID={testID}
      label={selected ? l`${title}, selected` : title}
      accessibilityHint={description}
      disabled={disabled}
      onPress={onPress}
      color={selected ? 'primary_subtle' : 'secondary'}
      size="large"
      style={[a.justify_start, a.align_start, a.py_md]}>
      <View style={[a.flex_row, a.align_center, a.gap_md, a.w_full]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {title}
          </Text>
          {description ? (
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {description}
            </Text>
          ) : null}
        </View>
        {selected ? <CheckIcon size="sm" fill={t.palette.primary_600} /> : null}
      </View>
    </Button>
  )
}
