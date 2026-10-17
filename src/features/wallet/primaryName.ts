/**
 * A primary name (eg "alice.base.eth") for a profile header: names longer
 * than `max` characters lose the middle of their first label and keep the
 * ending that says where they come from.
 */
export function displayPrimaryName(name: string, max = 28): string {
  if (name.length <= max) return name
  const dot = name.indexOf('.')
  const label = dot === -1 ? name : name.slice(0, dot)
  const rest = dot === -1 ? '' : name.slice(dot)
  const room = max - rest.length - 1
  // The ending alone is too long to leave room: cut the whole name
  if (room < 4) return `${name.slice(0, max - 1)}…`
  return `${label.slice(0, room)}…${rest}`
}

/** "0x1234...abcd", for showing which wallet a name points to */
export function shortAddress(address: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address
}
