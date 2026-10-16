import {device} from '#/storage'
import {type Permission, PERMISSIONS} from './logic'

/** What a person allowed a Mini App to do, for one version of the app */
export type MiniAppGrant = {
  did: string
  uri: string
  cid: string
  permissions: Permission[]
  grantedAt: number
}

function all(): MiniAppGrant[] {
  return device.get(['kraoMiniAppGrants']) ?? []
}

/**
 * The permissions the account gave this app at this version (`cid`). Editing
 * the app changes its cid, so an edited app has to ask again.
 */
export function getGrant(
  did: string,
  uri: string,
  cid: string,
): Permission[] | undefined {
  const grant = all().find(g => g.did === did && g.uri === uri && g.cid === cid)
  return grant?.permissions.filter(p => PERMISSIONS.includes(p))
}

export function saveGrant(
  did: string,
  uri: string,
  cid: string,
  permissions: Permission[],
) {
  device.set(
    ['kraoMiniAppGrants'],
    [
      // One grant per account and app: the newest version replaces the old
      ...all().filter(g => !(g.did === did && g.uri === uri)),
      {did, uri, cid, permissions, grantedAt: Date.now()},
    ],
  )
}

export function clearGrant(did: string, uri: string) {
  device.set(
    ['kraoMiniAppGrants'],
    all().filter(g => !(g.did === did && g.uri === uri)),
  )
}
