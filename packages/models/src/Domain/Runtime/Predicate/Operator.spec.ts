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
})
