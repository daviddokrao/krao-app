/*
 * Calls to Krao services other than rewards (see referral/api.ts): the gate
 * service (served by the indexer) and its moderation methods.
 */

export class ServiceError extends Error {
  constructor(
    public error: string | undefined,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function serviceFetch<T>(
  baseUrl: string,
  method: string,
  {params, token}: {params?: Record<string, string>; token?: string} = {},
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, baseUrl)
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: token ? {authorization: `Bearer ${token}`} : {},
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const {error, message} = data as {error?: string; message?: string}
    throw new ServiceError(error, message ?? `HTTP ${res.status}`, res.status)
  }
  return data as T
}
