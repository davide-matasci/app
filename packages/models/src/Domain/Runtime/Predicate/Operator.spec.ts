import { valueMatchesTargetValue } from './Operator'

describe('valueMatchesTargetValue', () => {
  it('matches "in" case-insensitively, like the other string operators', () => {
    expect(valueMatchesTargetValue('Meeting', 'in', ['Meeting', 'Todo'])).toBe(true)
    expect(valueMatchesTargetValue('todo', 'in', ['Meeting', 'Todo'])).toBe(true)
    expect(valueMatchesTargetValue('Other', 'in', ['Meeting', 'Todo'])).toBe(false)
  })

  it('keeps the meaning of a regex: \\D is not \\d', () => {
    expect(valueMatchesTargetValue('abc', 'matches', '^\\D+$')).toBe(true)
    expect(valueMatchesTargetValue('123', 'matches', '^\\D+$')).toBe(false)
  })

  it('matches regexes case-insensitively', () => {
    expect(valueMatchesTargetValue('Project Alpha', 'matches', '^project')).toBe(true)
  })

  describe('relative dates against text', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 10, 28, 9, 30))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('compares a title with that day written as YYYY-MM-DD', () => {
      expect(valueMatchesTargetValue('2025-11-28', '=', '1.years.ago')).toBe(true)
      expect(valueMatchesTargetValue('2025-11-27', '=', '1.years.ago')).toBe(false)
      expect(valueMatchesTargetValue('2026-11-27', '=', '1.days.ago')).toBe(true)
      expect(valueMatchesTargetValue('2026-10-28', '=', '1.months.ago')).toBe(true)
    })

    it('supports startsWith for titles with more after the date', () => {
      expect(valueMatchesTargetValue('2025-11-28 Friday', 'startsWith', '1.years.ago')).toBe(true)
      expect(valueMatchesTargetValue('2025-11-29 Saturday', 'startsWith', '1.years.ago')).toBe(false)
    })

    it('orders date titles, for ranges such as the last year', () => {
      expect(valueMatchesTargetValue('2026-03-01', '>', '1.years.ago')).toBe(true)
      expect(valueMatchesTargetValue('2025-03-01', '>', '1.years.ago')).toBe(false)
      expect(valueMatchesTargetValue('2025-11-28', '>=', '1.years.ago')).toBe(true)
    })

    it('still compares date fields as dates', () => {
      expect(valueMatchesTargetValue(new Date(2026, 5, 1), '>', '1.years.ago')).toBe(true)
      expect(valueMatchesTargetValue(new Date(2024, 5, 1), '>', '1.years.ago')).toBe(false)
    })
  })
})
