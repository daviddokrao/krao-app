import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {formatUsd, parseCashtagQuery, tokenPath} from '../logic'
import {useTokenCatalogQuery} from '../queries'
import {Change} from './Change'
import {TokenAvatar} from './TokenAvatar'

/**
 * Shown above the search results when the query is one cashtag of a known
 * token, e.g. `$ETH`. Renders nothing otherwise.
 */
export function TokenSearchRow({query}: {query: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const symbol = parseCashtagQuery(query)
  const {data: catalog} = useTokenCatalogQuery({enabled: !!symbol})
  const token = symbol ? catalog?.get(symbol) : undefined
  if (!token) return null
  const price = formatUsd(token.priceUsd)
  const {name} = token

  return (
    <Link
      testID="tokenSearchRow"
      to={tokenPath(token.symbol)}
      label={l`View token ${symbol}, ${name}`}
      style={[a.rounded_md, a.border, t.atoms.border_contrast_low, t.atoms.bg]}>
      <View style={[a.flex_row, a.align_center, a.gap_md, a.p_md]}>
        <TokenAvatar symbol={token.symbol} logo={token.logo} size={40} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
            {token.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Token</Trans>
            {` · $${token.symbol.toUpperCase()}`}
          </Text>
        </View>
        <View style={[a.align_end, a.gap_2xs]}>
          {price ? (
            <Text style={[a.text_md, a.font_semi_bold]}>{price}</Text>
          ) : null}
          <Change value={token.change24h} style={[a.text_sm]} />
        </View>
      </View>
    </Link>
  )
}
