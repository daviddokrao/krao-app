import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {openPhoneVerification} from '#/features/compliance/events'
import {restoreMessageText, showSecretWarning} from '#/features/safety/events'
import {type ConvoParams} from '../types'

jest.mock('#/features/safety/events', () => ({
  showSecretWarning: jest.fn(),
  restoreMessageText: jest.fn(),
}))
// The convo needs none of the session, which pulls in the whole UI
jest.mock('#/state/session', () => ({}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: 'View',
    FlatList: 'FlatList',
    ScrollView: 'ScrollView',
    createAnimatedComponent: (c: unknown) => c,
  },
}))
jest.mock('react-native-worklets', () => ({}))
jest.mock('#/features/compliance/events', () => ({
  openPhoneVerification: jest.fn(),
}))

import {Convo} from '../agent'

const TEXT = 'my seed: abandon abandon abandon'

function createConvo(error: string) {
  const call = jest.fn(() =>
    Promise.reject(Object.assign(new Error('refused'), {error})),
  )
  const convo = new Convo({
    convoId: 'convo-1',
    chatClient: {
      assertDid: 'did:plc:me',
      call,
    } as unknown as ConvoParams['chatClient'],
    events: {} as unknown as ConvoParams['events'],
  })
  return {convo, call}
}

const flush = () => new Promise(resolve => setTimeout(resolve, 20))

/** The queue is private; this is what stuck would look like */
function queueState(convo: Convo) {
  const c = convo as unknown as {
    pendingMessages: Map<string, unknown>
    pendingMessageFailure: unknown
    isProcessingPendingMessages: boolean
  }
  return {
    queued: c.pendingMessages.size,
    failure: c.pendingMessageFailure,
    processing: c.isProcessingPendingMessages,
  }
}

describe('a message the chat service refuses for good', () => {
  beforeEach(() => {
    jest.mocked(showSecretWarning).mockClear()
    jest.mocked(restoreMessageText).mockClear()
    jest.mocked(openPhoneVerification).mockClear()
  })

  it('leaves the queue, goes back to the input and explains (SensitiveSecret)', async () => {
    const {convo, call} = createConvo('SensitiveSecret')
    convo.sendMessage({text: TEXT})
    await flush()

    expect(call).toHaveBeenCalledTimes(1)
    expect(queueState(convo)).toEqual({
      queued: 0,
      failure: null,
      processing: false,
    })
    expect(restoreMessageText).toHaveBeenCalledWith({
      convoId: 'convo-1',
      text: TEXT,
    })
    expect(showSecretWarning).toHaveBeenCalledTimes(1)
    expect(openPhoneVerification).not.toHaveBeenCalled()

    // The convo is not stuck: the next message goes out on its own
    convo.sendMessage({text: 'hello'})
    await flush()
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('does the same for a missing phone number', async () => {
    const {convo} = createConvo('PhoneVerificationRequired')
    convo.sendMessage({text: 'hello'})
    await flush()

    expect(queueState(convo)).toEqual({
      queued: 0,
      failure: null,
      processing: false,
    })
    expect(restoreMessageText).toHaveBeenCalledWith({
      convoId: 'convo-1',
      text: 'hello',
    })
    expect(openPhoneVerification).toHaveBeenCalledWith('chat')
    expect(showSecretWarning).not.toHaveBeenCalled()
  })

  it('keeps any other failure in the queue for a retry', async () => {
    const {convo} = createConvo('InvalidRequest')
    convo.sendMessage({text: 'hello'})
    await flush()

    expect(queueState(convo).queued).toBe(1)
    expect(restoreMessageText).not.toHaveBeenCalled()
  })
})
