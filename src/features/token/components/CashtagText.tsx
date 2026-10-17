import {type StyleProp, type TextStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {InlineLinkText} from '#/components/Link'
import {splitCashtags, tokenPath} from '../logic'
import {useTokenCatalogQuery} from '../queries'

/**
 * Plain post text with its known cashtags turned into links to the token
 * screen. Use it as a child of a `Text`. Until the catalog has loaded, or if
 * it fails to, the text is shown as it is.
 */
export function CashtagText({
  text,
  linkStyle,
}: {
  text: string
  linkStyle?: StyleProp<TextStyle>
}) {
  const {t: l} = useLingui()
  const {data: catalog} = useTokenCatalogQuery()
  if (!catalog) return text
  const parts = splitCashtags(text, symbol => catalog.has(symbol))
  return (
    <>
      {parts.map((part, i) => {
        const {symbol} = part
        if (!symbol) return part.text
        return (
          <InlineLinkText
            key={i}
            to={tokenPath(symbol)}
            label={l`View token ${symbol}`}
            style={linkStyle}>
            {`$${symbol}`}
          </InlineLinkText>
        )
      })}
    </>
  )
}
