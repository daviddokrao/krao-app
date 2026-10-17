import {rewardsFetch} from '../referral/api'

/*
 * Weekly leaderboard of Krao's rewards service. Entries are the accounts
 * that opted in (off by default). Every call is signed in, like the other
 * rewards calls. The method names live here so they are easy to change.
 */

export const GET_LEADERBOARD = 'net.krao.points.getLeaderboard'
export const SET_LEADERBOARD_OPT_IN = 'net.krao.points.setLeaderboardOptIn'

/** The most entries asked for at once */
export const LEADERBOARD_LIMIT = 50

export type LeaderboardPeriod = {
  /** ISO times. `end` is the start of the next week. */
  start: string
  end: string
}

export type LeaderboardEntry = {
  did: string
  points: number
  rank: number
}

export type LeaderboardViewer = {
  optedIn: boolean
  /** Not set when the viewer is not on the board */
  rank?: number
  points: number
}

export type Leaderboard = {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  viewer?: LeaderboardViewer
}

export function getLeaderboard(token: string, limit = LEADERBOARD_LIMIT) {
  return rewardsFetch<Leaderboard>(GET_LEADERBOARD, {
    token,
    params: {period: 'week', limit: String(limit)},
  })
}

export function setLeaderboardOptIn(token: string, optIn: boolean) {
  return rewardsFetch<{optIn: boolean}>(SET_LEADERBOARD_OPT_IN, {
    token,
    body: {optIn},
  })
}
