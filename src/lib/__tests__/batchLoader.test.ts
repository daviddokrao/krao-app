import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {createBatchLoader} from '../batchLoader'

function identityLoad<K>() {
  return jest.fn((keys: K[]) => Promise.resolve(new Map(keys.map(k => [k, k]))))
}

describe('createBatchLoader', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('batches keys requested in the same tick into one call', async () => {
    const load = identityLoad<number>()
    const get = createBatchLoader({load, maxBatchSize: 10})
    const results = Promise.all([get(1), get(2), get(3)])
    await jest.advanceTimersByTimeAsync(10)
    expect(await results).toEqual([1, 2, 3])
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith([1, 2, 3])
  })

  it('does not load before the delay elapses', async () => {
    const load = identityLoad<number>()
    const get = createBatchLoader({load, maxBatchSize: 10, delayMs: 50})
    const p = get(1)
    await jest.advanceTimersByTimeAsync(49)
    expect(load).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(await p).toBe(1)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('dedupes repeated keys but resolves every caller', async () => {
    const load = identityLoad<string>()
    const get = createBatchLoader({load, maxBatchSize: 10})
    const results = Promise.all([get('a'), get('a'), get('b')])
    await jest.advanceTimersByTimeAsync(10)
    expect(await results).toEqual(['a', 'a', 'b'])
    expect(load).toHaveBeenCalledWith(['a', 'b'])
  })

  it('splits into chunks of maxBatchSize', async () => {
    const load = identityLoad<number>()
    const get = createBatchLoader({load, maxBatchSize: 2})
    const results = Promise.all([1, 2, 3, 4, 5].map(get))
    await jest.advanceTimersByTimeAsync(10)
    expect(await results).toEqual([1, 2, 3, 4, 5])
    expect(load.mock.calls.map(c => c[0])).toEqual([[1, 2], [3, 4], [5]])
  })

  it('resolves missing keys to undefined', async () => {
    const load = jest.fn((_keys: number[]) =>
      Promise.resolve(new Map([[1, 'one']])),
    )
    const get = createBatchLoader({load, maxBatchSize: 10})
    const results = Promise.all([get(1), get(2)])
    await jest.advanceTimersByTimeAsync(10)
    expect(await results).toEqual(['one', undefined])
  })

  it('rejects every caller in a failed batch only', async () => {
    const err = new Error('boom')
    const load = jest.fn((keys: number[]) =>
      keys.includes(1)
        ? Promise.reject(err)
        : Promise.resolve(new Map(keys.map(k => [k, k]))),
    )
    const get = createBatchLoader({load, maxBatchSize: 2})
    const settled = Promise.allSettled([get(1), get(2), get(3)])
    await jest.advanceTimersByTimeAsync(10)
    const [a, b, c] = await settled
    expect(a).toEqual({status: 'rejected', reason: err})
    expect(b).toEqual({status: 'rejected', reason: err})
    expect(c).toEqual({status: 'fulfilled', value: 3})
  })

  it('starts a new batch for keys requested after a flush', async () => {
    const load = identityLoad<number>()
    const get = createBatchLoader({load, maxBatchSize: 10})
    const first = get(1)
    await jest.advanceTimersByTimeAsync(10)
    await first
    const second = get(2)
    await jest.advanceTimersByTimeAsync(10)
    await second
    expect(load.mock.calls.map(c => c[0])).toEqual([[1], [2]])
  })
})
