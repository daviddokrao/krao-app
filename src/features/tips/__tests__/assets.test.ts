import {describe, expect, it} from '@jest/globals'

import {
  erc20TransferData,
  formatUnits,
  getTipAsset,
  parseUnits,
  TIP_ASSETS,
  TIP_CHAIN_ID,
} from '../assets'

describe('parseUnits', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseUnits('1', 6)).toBe(1_000_000n)
    expect(parseUnits('0.005', 18)).toBe(5_000_000_000_000_000n)
    expect(parseUnits('1.5', 6)).toBe(1_500_000n)
    expect(parseUnits('10.000001', 6)).toBe(10_000_001n)
  })

  it('trims whitespace', () => {
    expect(parseUnits('  2.5 ', 6)).toBe(2_500_000n)
  })

  it('parses zero', () => {
    expect(parseUnits('0', 18)).toBe(0n)
    expect(parseUnits('0.0', 6)).toBe(0n)
  })

  it('handles zero decimals', () => {
    expect(parseUnits('42', 0)).toBe(42n)
    expect(parseUnits('42.5', 0)).toBeNull()
  })

  it('rejects more fraction digits than allowed', () => {
    expect(parseUnits('1.0000001', 6)).toBeNull()
  })

  it('rejects invalid input', () => {
    for (const v of ['', ' ', 'abc', '-1', '+1', '1.', '.5', '1.2.3', '1e3']) {
      expect(parseUnits(v, 6)).toBeNull()
    }
  })
})

describe('formatUnits', () => {
  it('formats whole amounts without a fraction', () => {
    expect(formatUnits(5_000_000n, 6)).toBe('5')
    expect(formatUnits('5000000', 6)).toBe('5')
  })

  it('formats fractions and strips trailing zeros', () => {
    expect(formatUnits(1_500_000n, 6)).toBe('1.5')
    expect(formatUnits(5_000_000_000_000_000n, 18)).toBe('0.005')
  })

  it('formats zero', () => {
    expect(formatUnits(0n, 18)).toBe('0')
    expect(formatUnits('0', 6)).toBe('0')
  })

  it('handles zero decimals', () => {
    expect(formatUnits(42n, 0)).toBe('42')
  })

  it('round trips with parseUnits', () => {
    for (const asset of TIP_ASSETS) {
      for (const preset of asset.presets) {
        const parsed = parseUnits(preset, asset.decimals)
        expect(parsed).not.toBeNull()
        expect(formatUnits(parsed!, asset.decimals)).toBe(preset)
      }
    }
  })

  it('shortens long fractions to six digits', () => {
    expect(formatUnits(1_234_567_890_000_000_000n, 18)).toBe('1.234567')
  })

  it('drops the zeros left after shortening', () => {
    expect(formatUnits(1_000_000_000_000_000_001n, 18)).toBe('1')
    expect(formatUnits(1_500_000_000_000_000_001n, 18)).toBe('1.5')
  })

  it('shows a dust amount as less than the smallest shown unit', () => {
    expect(formatUnits(1n, 18)).toBe('<0.000001')
  })
})

describe('erc20TransferData', () => {
  const to = '0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb'

  it('starts with the transfer selector and has fixed length', () => {
    const data = erc20TransferData(to, 1n)
    expect(data.startsWith('0xa9059cbb')).toBe(true)
    expect(data).toHaveLength(2 + 8 + 64 + 64)
  })

  it('left-pads the lowercased address to 32 bytes', () => {
    const data = erc20TransferData(to, 1n)
    expect(data.slice(10, 74)).toBe(
      '000000000000000000000000' + to.slice(2).toLowerCase(),
    )
  })

  it('left-pads the amount to 32 bytes', () => {
    expect(erc20TransferData(to, 255n).slice(74)).toBe('ff'.padStart(64, '0'))
    expect(erc20TransferData(to, 0n).slice(74)).toBe('0'.repeat(64))
    expect(erc20TransferData(to, 5_000_000n).slice(74)).toBe(
      (5_000_000).toString(16).padStart(64, '0'),
    )
  })
})

describe('TIP_ASSETS', () => {
  it('has unique ids on the tip chain', () => {
    const ids = TIP_ASSETS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.startsWith(`eip155:${TIP_CHAIN_ID}/`)).toBe(true)
    }
  })

  it('has valid presets for each asset', () => {
    for (const asset of TIP_ASSETS) {
      expect(asset.decimals).toBeGreaterThanOrEqual(0)
      expect(asset.presets.length).toBeGreaterThan(0)
      for (const preset of asset.presets) {
        expect(parseUnits(preset, asset.decimals)).not.toBeNull()
      }
    }
  })

  it('ties the contract to the erc20 asset id', () => {
    for (const asset of TIP_ASSETS) {
      if (asset.contract) {
        expect(asset.id).toBe(`eip155:${TIP_CHAIN_ID}/erc20:${asset.contract}`)
      }
    }
  })

  it('looks up assets case-insensitively', () => {
    const usdc = TIP_ASSETS.find(a => a.symbol === 'USDC')!
    expect(getTipAsset(usdc.id.toUpperCase())).toBe(usdc)
    expect(getTipAsset('eip155:1/slip44:60')).toBeUndefined()
  })
})
