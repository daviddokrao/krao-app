import {describe, expect, it} from '@jest/globals'

import {
  buildReadReason,
  isValidReportId,
  READ_REASONS,
} from '../moderation/reason'

describe('buildReadReason', () => {
  it('is the category alone, or with a report id', () => {
    expect(buildReadReason('report', '')).toBe('report')
    expect(buildReadReason('legal', '  ')).toBe('legal')
    expect(buildReadReason('report', 'R-2026_10')).toBe('report:R-2026_10')
    expect(buildReadReason('appeal', ' 1234 ')).toBe('appeal:1234')
  })

  it('lets no free text through', () => {
    for (const bad of [
      'looks like a scam',
      'a&b',
      'a=b',
      'x/y',
      '../etc',
      'id%20',
      'tiếng',
      'a'.repeat(41),
    ]) {
      expect(buildReadReason('other', bad)).toBeNull()
    }
  })

  it('knows the categories the moderator can pick', () => {
    expect([...READ_REASONS]).toEqual(['report', 'legal', 'appeal', 'other'])
    expect(isValidReportId('abc-123')).toBe(true)
    expect(isValidReportId('')).toBe(false)
  })
})
