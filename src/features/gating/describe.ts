import {useLingui} from '@lingui/react/macro'

import {formatUnits, getTipAsset} from '#/features/tips/assets'
import {shortAddress} from '#/features/wallet/siwe'
import {type GateCondition, type GateRule} from './queries'

/** Returns a formatter for gate requirements, eg "≥ 10 USDC on Base" */
export function useDescribeCondition() {
  const {t: l} = useLingui()
  return (condition: GateCondition): string => {
    if (condition.$type === 'io.krao.gate.defs#tokenBalance') {
      const asset = getTipAsset(condition.asset)
      if (!asset) return l`a minimum token balance`
      const amount = formatUnits(condition.minAmount, asset.decimals)
      return l`≥ ${amount} ${asset.symbol} on Base`
    }
    const collection = shortAddress(condition.contract)
    return condition.tokenId
      ? l`a specific NFT from ${collection}`
      : l`any NFT from ${collection}`
  }
}

/** Returns a formatter for a whole gate, eg "≥ 10 USDC on Base and …" */
export function useDescribeRule() {
  const {t: l} = useLingui()
  const describe = useDescribeCondition()
  return (rule: GateRule): string => {
    const requirements = rule.conditions.map(describe)
    return rule.match === 'any'
      ? requirements.join(l` or `)
      : requirements.join(l` and `)
  }
}
