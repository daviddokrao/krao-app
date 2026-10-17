import {type Permission} from './logic'

/*
 * The host side of the Mini App SDK protocol (JSON over postMessage). Pure:
 * no React, no window. The frame component feeds it every message event and
 * gives it the means to send a reply, and the handlers do the real work
 * (identity, wallet, signing), each behind its own confirmation. Everything
 * the Mini App sends is untrusted input, so each step here rejects first and
 * asks later:
 *
 *   sender (source window + origin) -> size -> shape -> app approved ->
 *   permission -> params -> one signing request at a time -> handler
 */

export const PROTOCOL = 1

/** Messages bigger than this (as JSON) are dropped without an answer */
export const MAX_MESSAGE_BYTES = 64 * 1024

export const MAX_MESSAGE_CHARS = 10_000
const MAX_DATA_HEX_CHARS = 2 + 2 * 24_000
const MAX_ID_LENGTH = 100
const MAX_VALUE_DIGITS = 40

export type MiniAppMethod =
  'getContext' | 'requestWallet' | 'signMessage' | 'sendTransaction' | 'close'

/** The permission a method needs; `close` needs none */
export const METHOD_PERMISSION: Record<MiniAppMethod, Permission | null> = {
  getContext: 'identity',
  requestWallet: 'wallet',
  signMessage: 'sign',
  sendTransaction: 'transaction',
  close: null,
}

/** Methods that ask the user to confirm something: one at a time */
const EXCLUSIVE_METHODS: ReadonlySet<MiniAppMethod> = new Set([
  'requestWallet',
  'signMessage',
  'sendTransaction',
])

export type ErrorCode =
  | 'PermissionDenied'
  | 'UserRejected'
  | 'Unsupported'
  | 'NotApproved'
  | 'InvalidParams'
  | 'Failed'

/** An error the Mini App is told about, with a code it can act on */
export class BridgeError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code)
  }
}

export type SendTransactionParams = {
  to: string
  data?: string
  /** Wei, decimal */
  value?: string
}

export type MethodParams = {
  getContext: undefined
  requestWallet: undefined
  signMessage: {message: string}
  sendTransaction: SendTransactionParams
  close: undefined
}

export type MiniAppRequest = {
  [M in MiniAppMethod]: {id: string; method: M; params: MethodParams[M]}
}[MiniAppMethod]

export type Incoming =
  | {type: 'request'; id: string; method: string; params: unknown}
  | {type: 'ready'}
  | {type: 'ignore'}

const METHODS = Object.keys(METHOD_PERMISSION) as MiniAppMethod[]

function isMethod(value: string): value is MiniAppMethod {
  return (METHODS as string[]).includes(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Bytes of a string in UTF-8, without TextEncoder (not on every runtime) */
export function utf8Length(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      // A surrogate pair is one 4-byte character
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/**
 * The message as JSON text, or undefined when it is too big, not JSON, or
 * not serializable (cycles, BigInt, ...). A string is taken as the JSON
 * itself (native WebViews deliver strings).
 */
export function messageText(data: unknown): string | undefined {
  let text: string
  if (typeof data === 'string') {
    text = data
  } else {
    try {
      text = JSON.stringify(data)
    } catch {
      return undefined
    }
    if (typeof text !== 'string') return undefined
  }
  // Cheap bound first: a UTF-8 character is at most 3 bytes per UTF-16 unit
  if (text.length > MAX_MESSAGE_BYTES) return undefined
  return utf8Length(text) > MAX_MESSAGE_BYTES ? undefined : text
}

/**
 * Whether a message event comes from the Mini App's own frame: the exact
 * window the host created and the exact origin of its manifest. Any other
 * window (the host's other frames, popups, a parent) or origin is ignored,
 * and an opaque `null` origin never matches.
 */
export function isTrustedSender({
  source,
  frame,
  origin,
  expectedOrigin,
}: {
  source: unknown
  frame: unknown
  origin: string
  expectedOrigin: string
}): boolean {
  if (!expectedOrigin || expectedOrigin === 'null') return false
  if (source == null || frame == null) return false
  return source === frame && origin === expectedOrigin
}

/** Reads a message into a request or event, without trusting any field */
export function parseIncoming(data: unknown): Incoming {
  const text = messageText(data)
  if (text === undefined) return {type: 'ignore'}
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {type: 'ignore'}
  }
  if (!isPlainObject(parsed) || parsed.krao !== PROTOCOL) {
    return {type: 'ignore'}
  }
  if (typeof parsed.event === 'string') {
    return parsed.event === 'ready' ? {type: 'ready'} : {type: 'ignore'}
  }
  const {id, method, params} = parsed
  // Without a usable id there is nobody to answer
  if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH) {
    return {type: 'ignore'}
  }
  if (typeof method !== 'string') return {type: 'ignore'}
  return {type: 'request', id, method, params}
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HEX_DATA = /^0x(?:[0-9a-fA-F]{2})*$/

/** Wei as a decimal string from a decimal or 0x hex string */
function normalizeValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BridgeError('InvalidParams', 'value must be a string')
  }
  if (/^[0-9]+$/.test(value) && value.length <= MAX_VALUE_DIGITS) {
    return BigInt(value).toString()
  }
  if (/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    return BigInt(value).toString()
  }
  throw new BridgeError('InvalidParams', 'value must be an amount in wei')
}

/** Checks and normalizes a method's params; throws InvalidParams */
export function validateParams(
  method: MiniAppMethod,
  params: unknown,
): MethodParams[MiniAppMethod] {
  if (params !== undefined && params !== null && !isPlainObject(params)) {
    throw new BridgeError('InvalidParams', 'params must be an object')
  }
  const p: Record<string, unknown> = isPlainObject(params) ? params : {}
  switch (method) {
    case 'getContext':
    case 'requestWallet':
    case 'close':
      return undefined
    case 'signMessage': {
      const {message} = p
      if (
        typeof message !== 'string' ||
        !message ||
        message.length > MAX_MESSAGE_CHARS
      ) {
        throw new BridgeError('InvalidParams', 'message must be text')
      }
      return {message}
    }
    case 'sendTransaction': {
      const {to, data, value} = p
      if (typeof to !== 'string' || !ADDRESS.test(to)) {
        throw new BridgeError('InvalidParams', 'to must be an address')
      }
      if (
        data !== undefined &&
        (typeof data !== 'string' ||
          !HEX_DATA.test(data) ||
          data.length > MAX_DATA_HEX_CHARS)
      ) {
        throw new BridgeError('InvalidParams', 'data must be hex')
      }
      const out: SendTransactionParams = {to}
      if (data !== undefined && data !== '0x') out.data = data
      if (value !== undefined) out.value = normalizeValue(value)
      return out
    }
  }
}

/** The permissions in force: what the manifest declares and the user granted */
export function effectivePermissions(
  declared: readonly string[],
  granted: readonly string[],
): Set<Permission> {
  const result = new Set<Permission>()
  for (const p of granted) {
    if (declared.includes(p) && isPermission(p)) result.add(p)
  }
  return result
}

function isPermission(value: string): value is Permission {
  return (
    value === 'identity' ||
    value === 'wallet' ||
    value === 'sign' ||
    value === 'transaction'
  )
}

export type Handlers = {
  getContext: () => Promise<unknown>
  requestWallet: () => Promise<{address: string; chain: string}>
  signMessage: (params: {message: string}) => Promise<{signature: string}>
  sendTransaction: (params: SendTransactionParams) => Promise<{hash: string}>
  close: () => void
}

export type BridgeOptions = {
  /** Origin of the manifest URL: the only one listened to and written to */
  origin: string
  /** The window of the frame, or a stand-in on native (see isTrustedSender) */
  frame: () => unknown
  /** Read at each request: approval and the user's choices can change */
  isApproved: () => boolean
  permissions: () => ReadonlySet<Permission>
  handlers: Handlers
  /** Delivers a reply to the Mini App; the frame component adds the origin */
  send: (message: Record<string, unknown>, targetOrigin: string) => void
  onReady?: () => void
}

export type BridgeEvent = {data: unknown; origin: string; source: unknown}

export type Bridge = {
  handleMessage: (event: BridgeEvent) => Promise<void>
  /** Stop answering: the frame is closed */
  dispose: () => void
}

/** Makes the handler for one running Mini App */
export function createBridge(options: BridgeOptions): Bridge {
  let disposed = false
  let busy = false

  const reply = (message: Record<string, unknown>) => {
    if (disposed) return
    options.send({krao: PROTOCOL, ...message}, options.origin)
  }

  const fail = (id: string, err: unknown) => {
    const error =
      err instanceof BridgeError
        ? err
        : // Never forward the text of an unexpected error to the Mini App
          new BridgeError('Failed')
    reply({
      id,
      error: {
        code: error.code,
        ...(err instanceof BridgeError && err.message !== err.code
          ? {message: err.message}
          : {}),
      },
    })
  }

  const run = async (request: MiniAppRequest) => {
    const h = options.handlers
    switch (request.method) {
      case 'getContext':
        return h.getContext()
      case 'requestWallet':
        return h.requestWallet()
      case 'signMessage':
        return h.signMessage(request.params)
      case 'sendTransaction':
        return h.sendTransaction(request.params)
      case 'close':
        h.close()
        return {}
    }
  }

  return {
    dispose() {
      disposed = true
    },
    async handleMessage(event) {
      if (disposed) return
      if (
        !isTrustedSender({
          source: event.source,
          frame: options.frame(),
          origin: event.origin,
          expectedOrigin: options.origin,
        })
      ) {
        return
      }
      const incoming = parseIncoming(event.data)
      if (incoming.type === 'ready') {
        options.onReady?.()
        return
      }
      if (incoming.type !== 'request') return

      const {id} = incoming
      try {
        if (!isMethod(incoming.method)) {
          throw new BridgeError('Unsupported', 'Unknown method')
        }
        const method = incoming.method
        if (!options.isApproved()) {
          throw new BridgeError('NotApproved', 'This Mini App is not approved')
        }
        const needed = METHOD_PERMISSION[method]
        if (needed && !options.permissions().has(needed)) {
          throw new BridgeError('PermissionDenied', `${method} needs ${needed}`)
        }
        const params = validateParams(method, incoming.params)
        const exclusive = EXCLUSIVE_METHODS.has(method)
        if (exclusive && busy) {
          throw new BridgeError('Failed', 'Another request is still waiting')
        }
        if (exclusive) busy = true
        try {
          const result = await run({id, method, params} as MiniAppRequest)
          reply({id, result})
        } finally {
          if (exclusive) busy = false
        }
      } catch (err) {
        fail(id, err)
      }
    },
  }
}
