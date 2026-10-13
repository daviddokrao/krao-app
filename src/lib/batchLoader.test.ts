import {createBatchLoader} from './batchLoader'

describe('createBatchLoader', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function setup(maxBatchSize = 3) {
    const load = jest.fn((keys: string[]) =>
      Promise.resolve(
        new Map(keys.filter(k => k !== 'missing').map(k => [k, k + '!'])),
      ),
    )
    return {load, get: createBatchLoader({load, maxBatchSize})}
  }

  it('loads keys requested in the same window with one call', async () => {
    const {load, get} = setup()
    const results = Promise.all([get('a'), get('b')])
    await jest.runAllTimersAsync()
    expect(await results).toEqual(['a!', 'b!'])
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith(['a', 'b'])
  })

  it('dedupes keys and resolves every caller', async () => {
    const {load, get} = setup()
    const results = Promise.all([get('a'), get('a')])
    await jest.runAllTimersAsync()
    expect(await results).toEqual(['a!', 'a!'])
    expect(load).toHaveBeenCalledWith(['a'])
  })

  it('splits into chunks of maxBatchSize', async () => {
    const {load, get} = setup(2)
    const results = Promise.all(['a', 'b', 'c'].map(get))
    await jest.runAllTimersAsync()
    expect(await results).toEqual(['a!', 'b!', 'c!'])
    expect(load.mock.calls).toEqual([[['a', 'b']], [['c']]])
  })

  it('resolves missing keys to undefined', async () => {
    const {get} = setup()
    const result = get('missing')
    await jest.runAllTimersAsync()
    expect(await result).toBeUndefined()
  })

  it('rejects the callers of a failed chunk', async () => {
    const get = createBatchLoader<string, string>({
      load: () => Promise.reject(new Error('down')),
      maxBatchSize: 3,
    })
    const result = get('a')
    const assertion = expect(result).rejects.toThrow('down')
    await jest.runAllTimersAsync()
    await assertion
  })

  it('starts a new batch after flushing', async () => {
    const {load, get} = setup()
    const first = get('a')
    await jest.runAllTimersAsync()
    await first
    const second = get('b')
    await jest.runAllTimersAsync()
    await second
    expect(load).toHaveBeenCalledTimes(2)
  })
})
