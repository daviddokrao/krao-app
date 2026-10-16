/*
 * Why a moderator reads gated content. The reason travels in the request's
 * URL (so in server and proxy logs), and nothing but a fixed category and an
 * optional report id is let into it: no free text.
 */

export const READ_REASONS = ['report', 'legal', 'appeal', 'other'] as const

export type ReadReason = (typeof READ_REASONS)[number]

const REPORT_ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export function isValidReportId(id: string): boolean {
  return REPORT_ID_RE.test(id)
}

/**
 * "report" or "report:1234" (the category, and the report id if there is
 * one), or null when the id has anything else in it.
 */
export function buildReadReason(
  category: ReadReason,
  reportId: string,
): string | null {
  const id = reportId.trim()
  if (!id) return category
  return isValidReportId(id) ? `${category}:${id}` : null
}
