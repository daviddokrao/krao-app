/**
 * Collects the keys requested within a short window and loads them with as
 * few calls as possible, so per-item queries (eg one per feed post) share a
 * request. Keys missing from the result resolve to `undefined`.
 */
export function createBatchLoader<K, V>({
  load,
  maxBatchSize,
  delayMs = 10,
}: {
  load: (keys: K[]) => Promise<Map<K, V>>
  /** The most keys the backend accepts in one call */
  maxBatchSize: number
  delayMs?: number
}) {
  type Pending = {
    key: K
    resolve: (value: V | undefined) => void
    reject: (err: unknown) => void
  }
  let pending: Pending[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    const queued = pending
    pending = []
    timer = undefined
    const keys = [...new Set(queued.map(p => p.key))]
    for (let i = 0; i < keys.length; i += maxBatchSize) {
      const chunk = keys.slice(i, i + maxBatchSize)
      const waiting = queued.filter(p => chunk.includes(p.key))
      load(chunk).then(
        results => {
          for (const p of waiting) p.resolve(results.get(p.key))
        },
        err => {
          for (const p of waiting) p.reject(err)
        },
      )
    }
  }

  return (key: K) =>
    new Promise<V | undefined>((resolve, reject) => {
      pending.push({key, resolve, reject})
      timer ??= setTimeout(flush, delayMs)
    })
}
