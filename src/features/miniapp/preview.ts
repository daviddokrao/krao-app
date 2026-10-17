import {formatUnits} from '../tips/assets'

/*
 * What the indexer's net.krao.wallet.simulate / inspectSignature answer and
 * how the "Preview the transaction" box reads it. Pure, so the rules that
 * decide whether the user may sign are tested without a screen.
 */

export type Severity = 'info' | 'warning' | 'danger'

export type TokenInfo = {
  address: string
  symbol?: string
  name?: string
  decimals?: number
}

export type BalanceChange = {
  direction: 'out' | 'in'
  kind: 'native' | 'erc20' | 'erc721' | 'erc1155'
  token?: TokenInfo
  amount?: string
  tokenId?: string
  counterparty?: string
}

export type ApprovalView = {
  kind: 'erc20' | 'approvalForAll' | 'permit'
  token: TokenInfo
  spender: string
  amount?: string
  unlimited: boolean
}

export type PreviewWarning = {
  code: string
  severity: Severity
  message?: string
  /** The address the warning is about (a lookalike, a spender) */
  address?: string
}

export type SimulateResult = {
  ok: boolean
  revertReason?: string
  method: 'trace' | 'decode'
  changes: BalanceChange[]
  approvals: ApprovalView[]
  warnings: PreviewWarning[]
  gasEstimate?: string
  usdOut?: string
}

export type InspectResult = {
  kind:
    | 'message'
    | 'permit'
    | 'permit2'
    | 'order'
    | 'eip7702Authorization'
    | 'loginProof'
    | 'typedData'
  summary?: string
  approvals: ApprovalView[]
  warnings: PreviewWarning[]
}

/** What the preview box needs, from either answer (or from no answer) */
export type PreviewInput = {
  ok: boolean
  warnings: PreviewWarning[]
}

export type Verdict = {
  /** The service could not be reached, or could not simulate: signing is allowed, with a notice */
  unavailable: boolean
  /** Something to warn about at danger level: framed red, needs the tick */
  danger: boolean
  /** Whether the sign button can be used at all (before the tick) */
  canSign: boolean
  /** The user must tick "I understand the risk" first */
  needsAck: boolean
  /** Only decoded from calldata, not simulated */
  decodeOnly: boolean
}

const UNAVAILABLE = 'simulationUnavailable'

/**
 * Whether the user may go on to sign.
 *
 * - No answer (network error): fail open with a notice. A wallet still asks
 *   the user, and a broken indexer must not lock tips and memberships.
 * - `ok: false` blocks signing, except when the simulation was unavailable
 *   and nothing says the transaction reverts. With the RPC down the indexer
 *   still decodes the calldata, so its other warnings stay in force.
 * - Any danger warning needs the tick, and the main button becomes "Cancel".
 */
export function evaluatePreview(
  input:
    | (PreviewInput & {method?: 'trace' | 'decode'; revertReason?: string})
    | undefined,
): Verdict {
  if (!input) {
    return {
      unavailable: true,
      danger: false,
      canSign: true,
      needsAck: false,
      decodeOnly: false,
    }
  }
  const unavailable = input.warnings.some(w => w.code === UNAVAILABLE)
  // ok:false for any reason but a failing simulation (a revert) blocks signing
  const reverts =
    !!input.revertReason || input.warnings.some(w => w.code === 'reverts')
  const canSign = input.ok || (unavailable && !reverts)
  const danger = input.warnings.some(w => w.severity === 'danger')
  return {
    unavailable,
    danger,
    canSign,
    needsAck: canSign && danger,
    decodeOnly: input.method === 'decode',
  }
}

/** Danger first, then warnings, then notes; the order of the service within */
export function sortWarnings(warnings: PreviewWarning[]): PreviewWarning[] {
  const rank: Record<Severity, number> = {danger: 0, warning: 1, info: 2}
  return warnings
    .map((w, i) => ({w, i}))
    .sort((x, y) => rank[x.w.severity] - rank[y.w.severity] || x.i - y.i)
    .map(({w}) => w)
}

export type ChangeLine = {
  direction: 'out' | 'in'
  /** "0.001" or "#12", undefined when the service gave no amount */
  amount?: string
  /** Symbol, name, or a short address */
  asset: string
  /** Raw base units when the decimals are not known */
  raw?: string
  counterparty?: string
}

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb'

/**
 * The recipient and amount of an ERC-20 `transfer(address,uint256)` call,
 * read from the calldata the wallet will sign (not from the simulation), or
 * undefined for any other call. A token transfer is sent to the token's
 * contract, so without this the preview would show the contract as "To".
 */
export function decodeErc20Transfer(
  data: string | undefined,
): {recipient: string; amount: string} | undefined {
  if (!data || data.length !== 2 + 8 + 64 * 2) return undefined
  if (data.slice(0, 10).toLowerCase() !== ERC20_TRANSFER_SELECTOR) {
    return undefined
  }
  const addressWord = data.slice(10, 74)
  const amountWord = data.slice(74)
  if (
    !/^[0-9a-fA-F]{64}$/.test(addressWord) ||
    !/^[0-9a-fA-F]{64}$/.test(amountWord)
  ) {
    return undefined
  }
  // An address is the low 20 bytes: dirty high bytes are not a plain transfer
  if (!/^0{24}$/.test(addressWord.slice(0, 24))) return undefined
  return {
    recipient: `0x${addressWord.slice(24).toLowerCase()}`,
    amount: BigInt(`0x${amountWord}`).toString(),
  }
}

/** The token contract a transfer goes through, and who really receives it */
export type TransactionParties = {
  /** Who receives the value: the recipient of a token transfer, else `to` */
  recipient: string
  /** Set for a token transfer: the contract the call is sent to */
  tokenContract?: string
  /** Token amount in base units, for a token transfer */
  tokenAmount?: string
}

export function transactionParties(request: {
  to: string
  data?: string
}): TransactionParties {
  const transfer = decodeErc20Transfer(request.data)
  if (!transfer) return {recipient: request.to}
  return {
    recipient: transfer.recipient,
    tokenContract: request.to,
    tokenAmount: transfer.amount,
  }
}

export function shortAddress(address: string) {
  return address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address
}

function isBaseUnits(value: string | undefined): value is string {
  return !!value && /^[0-9]+$/.test(value)
}

/** One line of "You will lose / receive" */
export function describeChange(change: BalanceChange): ChangeLine {
  const counterparty = change.counterparty
  const base = {direction: change.direction, counterparty}
  if (change.kind === 'native') {
    return {
      ...base,
      amount: isBaseUnits(change.amount)
        ? formatUnits(change.amount, 18)
        : undefined,
      asset: change.token?.symbol ?? 'ETH',
    }
  }
  const asset =
    change.token?.symbol ??
    change.token?.name ??
    (change.token ? shortAddress(change.token.address) : '?')
  if (change.kind === 'erc20') {
    const decimals = change.token?.decimals
    if (isBaseUnits(change.amount) && typeof decimals === 'number') {
      return {...base, amount: formatUnits(change.amount, decimals), asset}
    }
    return {...base, asset, raw: change.amount}
  }
  // NFTs: the token id, and for ERC-1155 how many
  const id = change.tokenId ? `#${change.tokenId}` : undefined
  const count =
    change.kind === 'erc1155' &&
    isBaseUnits(change.amount) &&
    change.amount !== '1'
      ? `${change.amount} x `
      : ''
  return {...base, amount: id ? `${count}${id}` : undefined, asset}
}

export type ApprovalLine = {
  kind: ApprovalView['kind']
  asset: string
  spender: string
  unlimited: boolean
  /** Formatted amount, when limited and the decimals are known */
  amount?: string
}

/** One line of the approvals list */
export function describeApproval(approval: ApprovalView): ApprovalLine {
  const {token} = approval
  const asset = token.symbol ?? token.name ?? shortAddress(token.address)
  let amount: string | undefined
  if (
    !approval.unlimited &&
    isBaseUnits(approval.amount) &&
    typeof token.decimals === 'number'
  ) {
    amount = formatUnits(approval.amount, token.decimals)
  }
  return {
    kind: approval.kind,
    asset,
    spender: approval.spender,
    unlimited: approval.unlimited,
    amount,
  }
}

/** What a request to the preview box is about, for the title and the log */
export type PreviewRequest =
  | {
      kind: 'transaction'
      chain: string
      from: string
      to: string
      data?: string
      /** Wei, decimal */
      value?: string
      /** Origin of the Mini App that asked, if any */
      origin?: string
    }
  | {
      kind: 'signature'
      chain: string
      from: string
      method: 'personal_sign' | 'eth_signTypedData_v4'
      payload: string
      origin?: string
    }
