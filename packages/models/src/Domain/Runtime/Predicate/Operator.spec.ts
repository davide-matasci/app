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

  describe('date placeholders in patterns', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 10, 28, 9, 30))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('replaces {N.unit.ago} with that day written as YYYY-MM-DD', () => {
      expect(valueMatchesTargetValue('2025-11-28', 'matches', '^{1.years.ago}$')).toBe(true)
      expect(valueMatchesTargetValue('2025-11-27', 'matches', '^{1.years.ago}$')).toBe(false)
      expect(valueMatchesTargetValue('2026-11-28', 'matches', '^{0.days.ago}$')).toBe(true)
      expect(valueMatchesTargetValue('2026-10-28', 'matches', '^{1.months.ago}$')).toBe(true)
      expect(valueMatchesTargetValue('2026-11-21', 'matches', '^{7.days.ago}$')).toBe(true)
    })

    it('works inside a longer pattern, and more than once', () => {
      expect(valueMatchesTargetValue('Diary 2025-11-28 Friday', 'matches', 'diary {1.years.ago} \\w+')).toBe(true)
      expect(valueMatchesTargetValue('2024-11-28', 'matches', '^({1.years.ago}|{2.years.ago})$')).toBe(true)
      expect(valueMatchesTargetValue('2023-11-28', 'matches', '^({1.years.ago}|{2.years.ago})$')).toBe(false)
    })

    it('leaves ordinary patterns alone, including {n} quantifiers', () => {
      expect(valueMatchesTargetValue('2025-11-28', 'matches', '^\\d{4}-\\d{2}-\\d{2}$')).toBe(true)
      expect(valueMatchesTargetValue('a note from 3.days.ago', 'matches', '3\\.days\\.ago')).toBe(true)
    })

    it('still compares date fields with relative dates', () => {
      expect(valueMatchesTargetValue(new Date(2026, 5, 1), '>', '1.years.ago')).toBe(true)
      expect(valueMatchesTargetValue(new Date(2024, 5, 1), '>', '1.years.ago')).toBe(false)
    })
  })
})
