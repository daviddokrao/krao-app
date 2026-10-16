import {AtUri} from '@atproto/syntax'

import {
  type GateCondition,
  type NftHoldingCondition,
  type TokenBalanceCondition,
} from '#/features/gating/queries'

/*
 * Pure rules of Krao communities (net.krao.community.*): slugs, links, what
 * a viewer can do, and the shape of the records the app writes. No React and
 * no network, so they can be unit tested.
 */

export const COMMUNITY_COLLECTION = 'net.krao.community.profile'

export const SLUG_MIN = 3
export const SLUG_MAX = 40
export const NAME_MAX = 64
export const RULES_MAX = 10
export const RULE_MAX = 300
export const CONDITIONS_MAX = 5

export type AccessMode = 'open' | 'approval' | 'condition' | 'verified'
export const ACCESS_MODES: AccessMode[] = [
  'open',
  'approval',
  'condition',
  'verified',
]

export type ViewerStateName =
  'member' | 'pending' | 'ineligible' | 'banned' | 'none'

export type Role = 'owner' | 'moderator' | 'member'

/** The record key of a community is its slug */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN &&
    slug.length <= SLUG_MAX &&
    /^[a-z0-9-]+$/.test(slug)
  )
}

/** A slug suggestion from a name: lowercase, ASCII, dashes between words */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

export function makeCommunityUri(owner: string, slug: string): string {
  return `at://${owner}/${COMMUNITY_COLLECTION}/${slug}`
}

/** Splits a community URI into the owner (DID) and the slug */
export function parseCommunityUri(
  uri: string,
): {owner: string; slug: string} | undefined {
  try {
    const parsed = new AtUri(uri)
    if (parsed.collection !== COMMUNITY_COLLECTION || !parsed.rkey) return
    return {owner: parsed.host, slug: parsed.rkey}
  } catch {
    return
  }
}

/** The in-app path of a community, from its URI */
export function communityPath(uri: string): string {
  const parsed = parseCommunityUri(uri)
  return parsed ? `/community/${parsed.owner}/${parsed.slug}` : '/communities'
}

/** The viewer state of a community view, with the codes the app knows */
export type ViewerState = {
  state: ViewerStateName | (string & {})
  role?: Role | (string & {})
  eligible?: boolean
  reason?: string
  membership?: string
}

/** What the primary button of a community page does */
export type MembershipAction =
  'join' | 'request' | 'leave' | 'cancelRequest' | 'cannotJoin' | 'none'

/**
 * The membership action offered to the viewer. `signedIn` false offers
 * nothing (the page asks them to sign in).
 */
export function getMembershipAction(
  mode: AccessMode,
  viewer: ViewerState | undefined,
  signedIn: boolean,
): MembershipAction {
  if (!signedIn) return 'none'
  const state = viewer?.state ?? 'none'
  switch (state) {
    case 'banned':
      return 'none'
    case 'member':
      // The owner cannot leave their own community
      return viewer?.role === 'owner' ? 'none' : 'leave'
    case 'pending':
      return 'cancelRequest'
    case 'ineligible':
      return 'leave'
    default:
      if (viewer?.eligible === false) return 'cannotJoin'
      return mode === 'approval' ? 'request' : 'join'
  }
}

/** Owners and moderators approve members, hide posts and ban */
export function canModerate(viewer: ViewerState | undefined): boolean {
  return (
    viewer?.state === 'member' &&
    (viewer.role === 'owner' || viewer.role === 'moderator')
  )
}

export function isOwner(viewer: ViewerState | undefined): boolean {
  return viewer?.state === 'member' && viewer.role === 'owner'
}

/**
 * Whether the viewer may submit their posts to the community: members in
 * good standing (the indexer ignores submissions of anyone else).
 */
export function canPostTo(viewer: ViewerState | undefined): boolean {
  return viewer?.state === 'member'
}

/** Lines of a text box as rules: trimmed, without empty lines */
export function parseRules(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

export type CommunityDraft = {
  name: string
  slug: string
  rulesText: string
  mode: AccessMode
  conditions: GateCondition[]
  match: 'all' | 'any'
  chatJoinLink: string
}

export type DraftProblem = 'name' | 'slug' | 'rules' | 'conditions' | 'chatLink'

const graphemeLength = (text: string) => [...text].length

/** What is wrong with a draft, empty when it can be saved */
export function validateCommunityDraft(
  draft: CommunityDraft,
  {isNew}: {isNew: boolean},
): DraftProblem[] {
  const problems: DraftProblem[] = []
  const name = draft.name.trim()
  if (!name || graphemeLength(name) > NAME_MAX) problems.push('name')
  if (isNew && !isValidSlug(draft.slug)) problems.push('slug')
  const rules = parseRules(draft.rulesText)
  if (
    rules.length > RULES_MAX ||
    rules.some(rule => graphemeLength(rule) > RULE_MAX)
  ) {
    problems.push('rules')
  }
  if (
    draft.mode === 'condition' &&
    (draft.conditions.length < 1 || draft.conditions.length > CONDITIONS_MAX)
  ) {
    problems.push('conditions')
  }
  const link = draft.chatJoinLink.trim()
  if (link && !/^https?:\/\/\S+$/.test(link)) problems.push('chatLink')
  return problems
}

/**
 * The `access` object of a profile record. Condition items keep their $type
 * (the union needs it); the other modes carry no conditions.
 */
export function buildAccess(draft: CommunityDraft) {
  if (draft.mode !== 'condition') return {mode: draft.mode}
  return {
    mode: draft.mode,
    conditions: draft.conditions.filter(
      (c): c is TokenBalanceCondition | NftHoldingCondition =>
        c.$type !== 'net.krao.gate.defs#communityMember',
    ),
    match: draft.match,
  }
}

/** The text of a member-only gate on a post in a community */
export function memberOnlyCondition(community: string): GateCondition {
  return {$type: 'net.krao.gate.defs#communityMember', community}
}

/** Short stable label for a reason code the indexer returns */
export type ReasonKey =
  | 'NoWallet'
  | 'ConditionsNotMet'
  | 'NotVerified'
  | 'VerificationUnavailable'
  | 'AwaitingApproval'
  | 'NotCheckedYet'
  | 'Banned'
  | 'other'

export function toReasonKey(reason: string | undefined): ReasonKey {
  switch (reason) {
    case 'NoWallet':
    case 'ConditionsNotMet':
    case 'NotVerified':
    case 'VerificationUnavailable':
    case 'AwaitingApproval':
    case 'NotCheckedYet':
    case 'Banned':
      return reason
    default:
      return 'other'
  }
}

/**
 * Which privacy notice to show before joining: the membership record is
 * public, and for these modes it indirectly shows how the account qualified.
 */
export function joinPrivacyNotice(
  mode: AccessMode,
): 'verified' | 'condition' | undefined {
  return mode === 'verified' || mode === 'condition' ? mode : undefined
}
