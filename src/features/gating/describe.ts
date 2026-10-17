import {useLingui} from '@lingui/react/macro'

import {formatUnits, getTipAsset} from '#/features/tips/assets'
import {shortAddress} from '#/features/wallet/siwe'
import {type GateCondition, type GateRule} from './queries'

/** Returns a formatter for gate requirements, eg "≥ 10 USDC on Base" */
export function useDescribeCondition() {
  const {t: l} = useLingui()
  return (condition: GateCondition): string => {
    if (condition.$type === 'net.krao.gate.defs#tokenBalance') {
      const asset = getTipAsset(condition.asset)
      if (!asset) return l`a minimum token balance`
      const amount = formatUnits(condition.minAmount, asset.decimals)
      return l`≥ ${amount} ${asset.symbol} on Base`
    }
    if (condition.$type === 'net.krao.gate.defs#communityMember') {
      return l`membership of a Krao community`
    }
    if (condition.$type === 'net.krao.gate.defs#membership') {
      return condition.plan
        ? l`members of a specific membership plan`
        : l`members of a creator`
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

/** The community a gate that only asks for membership points to */
export function getMembershipOnlyCommunity(rule: GateRule): string | undefined {
  const first = rule.conditions[0]
  if (
    first?.$type === 'net.krao.gate.defs#communityMember' &&
    rule.conditions.every(c => c.$type === first.$type)
  ) {
    return first.community
  }
}

/** The creator a gate that only asks for their membership points to */
export function getMembershipOnlyCreator(rule: GateRule): string | undefined {
  const first = rule.conditions[0]
  if (
    first?.$type === 'net.krao.gate.defs#membership' &&
    rule.conditions.every(c => c.$type === first.$type)
  ) {
    return first.creator
  }
}

/** Returns a formatter for the heading shown on gated content and badges */
export function useGateHeading() {
  const {t: l} = useLingui()
  const describeRule = useDescribeRule()
  return (rule: GateRule): string =>
    getMembershipOnlyCommunity(rule) || getMembershipOnlyCreator(rule)
      ? l`Members only`
      : l`Token-gated · holders of ${describeRule(rule)}`
}
