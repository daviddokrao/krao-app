/*
 * Krao's unified admin area (net.krao.admin.*, served by the rewards
 * service): which roles an account has, which sections they open, and how
 * roles and audit entries are shown. Pure, so it can be unit tested.
 */

export const ROLES = [
  'admin',
  'rewards',
  'kyc',
  'safety',
  'moderator',
  'analytics',
] as const
export type AdminRole = (typeof ROLES)[number]

export type RoleSource = 'env' | 'db'

export type MemberRole = {
  role: AdminRole
  source: RoleSource
  grantedBy?: string
  grantedAt?: string
}

export type RoleMember = {
  did: string
  handle?: string
  roles: MemberRole[]
}

export type AuditService = 'rewards' | 'indexer' | 'chat' | 'moderation'
export const AUDIT_SERVICES: AuditService[] = [
  'rewards',
  'indexer',
  'chat',
  'moderation',
]

export type AuditEntry = {
  id: string | number
  service: string
  actor: string
  action: string
  subject?: string
  details?: unknown
  createdAt: string
}

export type AdminSectionId =
  'rewards' | 'kyc' | 'safety' | 'moderator' | 'analytics' | 'roles' | 'audit'

export type AdminSection = {
  id: AdminSectionId
  /** Where it opens (a route path of the app) */
  to: string
  /** Roles that open it besides `admin`, who opens everything */
  roles: AdminRole[]
}

/**
 * The cards of the hub, in display order. The screens behind the first five
 * already existed and keep their paths; the hub only links to them. Roles and
 * the log are for `admin` only (no other role in their list).
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {id: 'rewards', to: '/settings/referral/admin', roles: ['rewards']},
  {id: 'kyc', to: '/settings/referral/admin', roles: ['kyc']},
  {id: 'safety', to: '/settings/miniapps-admin', roles: ['safety']},
  {id: 'moderator', to: '/settings/gate-moderation', roles: ['moderator']},
  {
    id: 'analytics',
    to: '/settings/referral/admin/analytics',
    roles: ['analytics'],
  },
  {id: 'roles', to: '/admin/roles', roles: []},
  {id: 'audit', to: '/admin/audit', roles: []},
]

/**
 * What the service sent as roles, reduced to roles this app knows, without
 * duplicates and in the fixed order. Anything else (a role of a newer
 * service, a non-list) is dropped. Not expanded: `admin` stays `admin`.
 */
export function normalizeRoles(input: unknown): AdminRole[] {
  if (!Array.isArray(input)) return []
  return ROLES.filter(role => input.includes(role))
}

/** `admin` has every role without being granted each */
export function hasRole(roles: AdminRole[], role: AdminRole): boolean {
  return roles.includes('admin') || roles.includes(role)
}

/** The hub cards this set of roles opens; none for an account with no role */
export function sectionsForRoles(roles: AdminRole[]): AdminSection[] {
  if (!roles.length) return []
  return ADMIN_SECTIONS.filter(section =>
    section.roles.length
      ? section.roles.some(role => hasRole(roles, role))
      : roles.includes('admin'),
  )
}

/**
 * The hub shows one card per destination: an admin has `rewards` and `kyc`
 * for the same screen, and one link is enough.
 */
export function dedupeSections(sections: AdminSection[]): AdminSection[] {
  const seen = new Set<string>()
  return sections.filter(section => {
    if (seen.has(section.to)) return false
    seen.add(section.to)
    return true
  })
}

/** A role the member holds only through the environment cannot be removed */
export function isLockedRole(role: MemberRole): boolean {
  return role.source === 'env'
}

/**
 * Whether the viewer may switch `role` on or off for `member`. Env roles are
 * locked, and nobody removes their own `admin` (the service refuses too).
 */
export function canToggleRole(
  viewerDid: string | undefined,
  member: RoleMember,
  role: AdminRole,
): boolean {
  const held = member.roles.find(r => r.role === role)
  if (held && isLockedRole(held)) return false
  if (held && role === 'admin' && member.did === viewerDid) return false
  if (isImpliedRole(member, role)) return false
  return true
}

/**
 * A role the member has only because they are an admin: shown as on, and
 * not switched on its own (granting it would change nothing).
 */
export function isImpliedRole(member: RoleMember, role: AdminRole): boolean {
  return (
    role !== 'admin' &&
    !member.roles.some(r => r.role === role) &&
    member.roles.some(r => r.role === 'admin')
  )
}

export type SetRoleProblem =
  'env' | 'ownAdmin' | 'unknownRole' | 'forbidden' | 'other'

/** Why the service refused a role change (`setRole` errors), for a message */
export function setRoleProblem(error: unknown): SetRoleProblem {
  const {error: name, status} = (error ?? {}) as {
    error?: unknown
    status?: unknown
  }
  if (name === 'EnvRole') return 'env'
  if (name === 'OwnAdminRole') return 'ownAdmin'
  if (name === 'UnknownRole') return 'unknownRole'
  if (status === 401 || status === 403) return 'forbidden'
  return 'other'
}

/** Members in a stable order: handle, then DID; members with no role last */
export function sortMembers(members: RoleMember[]): RoleMember[] {
  return [...members].sort((x, y) => {
    if (!!x.roles.length !== !!y.roles.length) return x.roles.length ? -1 : 1
    return (x.handle ?? x.did).localeCompare(y.handle ?? y.did)
  })
}

/** Roles of a member in the fixed order, ignoring roles this app does not know */
export function memberRoles(member: RoleMember): MemberRole[] {
  return ROLES.map(role => member.roles.find(r => r.role === role)).filter(
    (r): r is MemberRole => !!r,
  )
}

/** The `getAuditLog` query for a filter; empty filters are left out */
export function auditParams({
  service,
  actor,
  limit = 50,
  cursor,
}: {
  service?: AuditService
  actor?: string
  limit?: number
  cursor?: string
}): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(Math.min(Math.max(Math.trunc(limit) || 50, 1), 100)),
  }
  if (service) params.service = service
  if (actor?.trim()) params.actor = actor.trim()
  if (cursor) params.cursor = cursor
  return params
}

const DETAILS_MAX = 400

/**
 * The details of an audit entry as short text for a list row: strings as
 * they are, other values as compact JSON, cut at 400 characters. Empty when
 * there is nothing to show.
 */
export function formatAuditDetails(details: unknown): string {
  if (details === undefined || details === null || details === '') return ''
  let text: string
  if (typeof details === 'string') {
    text = details
  } else {
    try {
      text = JSON.stringify(details) ?? ''
    } catch {
      return ''
    }
  }
  if (text === '{}' || text === '[]') return ''
  const chars = Array.from(text)
  return chars.length > DETAILS_MAX
    ? `${chars.slice(0, DETAILS_MAX).join('')}…`
    : text
}

/** The service of an entry, if it is one the filter knows */
export function auditService(entry: {service: string}): AuditService | null {
  return AUDIT_SERVICES.find(s => s === entry.service) ?? null
}

/** "did:plc:abc" and the like: subjects and actors that are accounts */
export function isDid(value: string | undefined): value is string {
  return !!value && /^did:[a-z]+:\S+$/.test(value)
}
