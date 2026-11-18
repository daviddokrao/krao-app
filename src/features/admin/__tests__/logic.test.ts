import {
  type AdminRole,
  auditParams,
  canToggleRole,
  dedupeSections,
  formatAuditDetails,
  hasRole,
  isDid,
  isImpliedRole,
  normalizeRoles,
  type RoleMember,
  sectionsForRoles,
  setRoleProblem,
  sortMembers,
} from '../logic'

const ids = (roles: AdminRole[]) => sectionsForRoles(roles).map(s => s.id)

describe('normalizeRoles', () => {
  it('keeps known roles once, in the fixed order', () => {
    expect(normalizeRoles(['safety', 'admin', 'safety', 'owner', 3])).toEqual([
      'admin',
      'safety',
    ])
  })
  it('gives none for anything that is not a list', () => {
    expect(normalizeRoles(undefined)).toEqual([])
    expect(normalizeRoles({roles: ['admin']})).toEqual([])
  })
})

describe('sectionsForRoles', () => {
  it('is empty without a role', () => {
    expect(ids([])).toEqual([])
  })
  it('opens only what the role is for', () => {
    expect(ids(['safety'])).toEqual(['safety'])
    expect(ids(['moderator'])).toEqual(['moderator'])
    expect(ids(['kyc'])).toEqual(['kyc'])
    expect(ids(['analytics'])).toEqual(['analytics'])
  })
  it('gives admin everything, including roles and the log', () => {
    expect(ids(['admin'])).toEqual([
      'rewards',
      'kyc',
      'safety',
      'moderator',
      'analytics',
      'roles',
      'audit',
    ])
  })
  it('does not open roles or the log without admin', () => {
    const all = ids(['rewards', 'kyc', 'safety', 'moderator', 'analytics'])
    expect(all).not.toContain('roles')
    expect(all).not.toContain('audit')
  })
  it('hasRole counts admin as every role', () => {
    expect(hasRole(['admin'], 'safety')).toBe(true)
    expect(hasRole(['rewards'], 'safety')).toBe(false)
  })
  it('dedupeSections links one card per destination', () => {
    const cards = dedupeSections(sectionsForRoles(['admin']))
    expect(cards.map(c => c.id)).toEqual([
      'rewards',
      'safety',
      'moderator',
      'analytics',
      'roles',
      'audit',
    ])
  })
})

describe('canToggleRole', () => {
  const member: RoleMember = {
    did: 'did:plc:me',
    roles: [
      {role: 'admin', source: 'db'},
      {role: 'safety', source: 'env'},
    ],
  }
  it('locks roles that come from the environment', () => {
    expect(canToggleRole('did:plc:you', member, 'safety')).toBe(false)
  })
  it('does not let anyone drop their own admin', () => {
    expect(canToggleRole('did:plc:me', member, 'admin')).toBe(false)
    expect(canToggleRole('did:plc:you', member, 'admin')).toBe(true)
  })
  it('lets a role be added', () => {
    const plain: RoleMember = {
      did: 'did:plc:me',
      roles: [{role: 'safety', source: 'db'}],
    }
    expect(canToggleRole('did:plc:you', plain, 'moderator')).toBe(true)
  })
  it('does not switch roles an admin already has through admin', () => {
    expect(canToggleRole('did:plc:you', member, 'moderator')).toBe(false)
    expect(isImpliedRole(member, 'moderator')).toBe(true)
    // Held on its own: a real grant, not implied
    expect(isImpliedRole(member, 'safety')).toBe(false)
    expect(isImpliedRole(member, 'admin')).toBe(false)
    expect(
      isImpliedRole(
        {did: 'did:plc:x', roles: [{role: 'kyc', source: 'db'}]},
        'safety',
      ),
    ).toBe(false)
  })
})

describe('setRoleProblem', () => {
  it('names the errors of setRole', () => {
    expect(setRoleProblem({error: 'EnvRole', status: 400})).toBe('env')
    expect(setRoleProblem({error: 'OwnAdminRole', status: 400})).toBe(
      'ownAdmin',
    )
    expect(setRoleProblem({error: 'UnknownRole', status: 400})).toBe(
      'unknownRole',
    )
    expect(setRoleProblem({error: 'AuthRequired', status: 403})).toBe(
      'forbidden',
    )
    expect(setRoleProblem(new Error('offline'))).toBe('other')
    expect(setRoleProblem(undefined)).toBe('other')
  })
})

describe('sortMembers', () => {
  it('puts members with roles first, then by handle', () => {
    const sorted = sortMembers([
      {did: 'did:plc:c', handle: 'c.test', roles: []},
      {
        did: 'did:plc:b',
        handle: 'b.test',
        roles: [{role: 'kyc', source: 'db'}],
      },
      {
        did: 'did:plc:a',
        handle: 'a.test',
        roles: [{role: 'kyc', source: 'db'}],
      },
    ])
    expect(sorted.map(m => m.did)).toEqual([
      'did:plc:a',
      'did:plc:b',
      'did:plc:c',
    ])
  })
})

describe('auditParams', () => {
  it('leaves empty filters out and clamps the limit', () => {
    expect(auditParams({actor: '  ', limit: 500})).toEqual({limit: '100'})
    expect(
      auditParams({service: 'indexer', actor: ' did:plc:x ', cursor: 'c1'}),
    ).toEqual({
      limit: '50',
      service: 'indexer',
      actor: 'did:plc:x',
      cursor: 'c1',
    })
  })
})

describe('formatAuditDetails', () => {
  it('is empty when there is nothing', () => {
    expect(formatAuditDetails(undefined)).toBe('')
    expect(formatAuditDetails(null)).toBe('')
    expect(formatAuditDetails({})).toBe('')
  })
  it('shows strings as is and objects as compact JSON', () => {
    expect(formatAuditDetails('reason')).toBe('reason')
    expect(formatAuditDetails({role: 'safety', enabled: true})).toBe(
      '{"role":"safety","enabled":true}',
    )
  })
  it('cuts long text without splitting a character', () => {
    const out = formatAuditDetails('😀'.repeat(500))
    expect(Array.from(out)).toHaveLength(401)
    expect(out.endsWith('…')).toBe(true)
  })
  it('survives values JSON cannot take', () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop
    expect(formatAuditDetails(loop)).toBe('')
  })
})

describe('isDid', () => {
  it('tells accounts from other subjects', () => {
    expect(isDid('did:plc:abc123')).toBe(true)
    expect(isDid('at://did:plc:abc/app.bsky.feed.post/1')).toBe(false)
    expect(isDid(undefined)).toBe(false)
  })
})
