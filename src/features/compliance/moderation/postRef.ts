/*
 * A moderator names a post by its link or its AT URI. Handles in them are
 * resolved to DIDs by the caller (the gate service keys content by the
 * post's AT URI with the author's DID).
 */

export type PostRef = {uri: string} | {name: string; rkey: string}

const POST_COLLECTION = 'app.bsky.feed.post'

export function parsePostRef(input: string): PostRef | null {
  const text = input.trim()
  if (!text) return null
  let name: string | undefined
  let rkey: string | undefined
  if (text.startsWith('at://')) {
    const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)\/?$/.exec(text)
    if (!m || m[2] !== POST_COLLECTION) return null
    name = m[1]
    rkey = m[3]
  } else {
    let url: URL
    try {
      url = new URL(text)
    } catch {
      return null
    }
    const m = /^\/profile\/([^/]+)\/post\/([^/]+)\/?$/.exec(url.pathname)
    if (!m) return null
    name = decodeURIComponent(m[1])
    rkey = decodeURIComponent(m[2])
  }
  if (name.startsWith('did:')) {
    return {uri: `at://${name}/${POST_COLLECTION}/${rkey}`}
  }
  return {name: name.replace(/^@/, ''), rkey}
}
