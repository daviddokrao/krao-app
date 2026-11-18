/** Chain that tips are sent on (Base mainnet, or the local Anvil fork in dev) */
export const TIP_CHAIN_ID = 8453

export type TipAsset = {
  /** CAIP-19 asset id */
  id: string
  symbol: string
  decimals: number
  /** ERC-20 contract, or undefined for the chain's native coin */
  contract?: string
  /** Quick-pick amounts, in whole units */
  presets: string[]
}

export const TIP_ASSETS: TipAsset[] = [
  {
    id: 'eip155:8453/slip44:60',
    symbol: 'ETH',
    decimals: 18,
    presets: ['0.0005', '0.001', '0.005'],
  },
  {
    id: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    presets: ['1', '5', '10'],
  },
]

export function getTipAsset(id: string): TipAsset | undefined {
  return TIP_ASSETS.find(a => a.id.toLowerCase() === id.toLowerCase())
}

/** Parse a decimal amount like "0.005" into base units, or null if invalid */
export function parseUnits(value: string, decimals: number): bigint | null {
  const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(value.trim())
  if (!match) return null
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) return null
  return BigInt(match[1] + fraction.padEnd(decimals, '0'))
}

/** Format base units as a short decimal string, eg 5000000 (6) -> "5" */
export function formatUnits(amount: string | bigint, decimals: number): string {
  const value = BigInt(amount)
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  // At most 6 decimals; zeros left over after cutting are dropped too
  const fraction = (value % base)
    .toString()
    .padStart(decimals, '0')
    .slice(0, 6)
    .replace(/0+$/, '')
  if (fraction) return `${whole}.${fraction}`
  // A non-zero amount too small to show
  return whole === 0n && value > 0n ? '<0.000001' : whole.toString()
}

/** Calldata for ERC-20 transfer(to, amount) */
export function erc20TransferData(to: string, amount: bigint): string {
  const pad = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0')
  return '0xa9059cbb' + pad(to.toLowerCase()) + pad(amount.toString(16))
}
