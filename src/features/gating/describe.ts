import {useLingui} from '@lingui/react/macro'

import {formatUnits, getTipAsset} from '#/features/tips/assets'
import {shortAddress} from '#/features/wallet/siwe'
import {type GateCondition} from './queries'

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
