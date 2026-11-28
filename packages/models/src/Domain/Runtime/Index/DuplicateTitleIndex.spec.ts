import { ContentType } from '@standardnotes/domain-core'
import { DuplicateTitleIndex } from './DuplicateTitleIndex'
import { ItemDelta } from './ItemDelta'

const note = (uuid: string, title: string | undefined, extra: { trashed?: boolean; archived?: boolean } = {}) =>
  ({ uuid, content_type: ContentType.TYPES.Note, title, ...extra }) as never

const changed = (...items: never[]) => ({ changed: items }) as Partial<ItemDelta>

describe('DuplicateTitleIndex', () => {
  it('finds notes that share a title, ignoring case and surrounding spaces', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({ inserted: [note('a', '2025-11-28'), note('b', ' 2025-11-28 '), note('c', 'Shopping')] })
    index.onChange({ inserted: [note('d', 'shopping'), note('e', 'Unique')] })

    expect(['a', 'b', 'c', 'd', 'e'].map((uuid) => index.hasDuplicateTitle(uuid))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ])
    expect(index.duplicateCount()).toBe(4)
  })

  it('does not count notes without a title, in the trash or archived', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({
      inserted: [
        note('a', ''),
        note('b', '   '),
        note('c', undefined),
        note('d', 'Plan'),
        note('e', 'Plan', { trashed: true }),
        note('f', 'Plan', { archived: true }),
      ],
    })

    expect(index.duplicateCount()).toBe(0)
    expect(index.hasDuplicateTitle('d')).toBe(false)
  })

  it('only counts notes', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({
      inserted: [note('a', 'Plan'), { uuid: 'b', content_type: ContentType.TYPES.Tag, title: 'Plan' } as never],
    })

    expect(index.duplicateCount()).toBe(0)
  })

  it('reports the other note when a rename ends or starts a duplicate', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({ inserted: [note('a', 'Plan'), note('b', 'Plan'), note('c', 'Other')] })

    expect(index.onChange(changed(note('a', 'Renamed')))).toEqual(['b'])
    expect(index.hasDuplicateTitle('b')).toBe(false)
    expect(index.duplicateCount()).toBe(0)

    expect(index.onChange(changed(note('a', 'other')))).toEqual(['c'])
    expect(index.hasDuplicateTitle('a')).toBe(true)
    expect(index.hasDuplicateTitle('c')).toBe(true)
  })

  it('reports nothing when a third note joins or leaves an existing group, or nothing relevant changes', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({ inserted: [note('a', 'Plan'), note('b', 'Plan')] })

    expect(index.onChange({ inserted: [note('c', 'Plan')] })).toEqual([])
    expect(index.onChange(changed(note('c', 'Something else')))).toEqual([])
    expect(index.onChange(changed(note('a', 'Plan')))).toEqual([])
    expect(index.duplicateCount()).toBe(2)
  })

  it('updates when a note is trashed, restored or deleted', () => {
    const index = new DuplicateTitleIndex()
    index.onChange({ inserted: [note('a', 'Plan'), note('b', 'Plan')] })

    expect(index.onChange(changed(note('a', 'Plan', { trashed: true })))).toEqual(['b'])
    expect(index.duplicateCount()).toBe(0)

    expect(index.onChange(changed(note('a', 'Plan')))).toEqual(['b'])
    expect(index.duplicateCount()).toBe(2)

    expect(index.onChange({ discarded: [{ uuid: 'b' } as never] })).toEqual(['a'])
    expect(index.duplicateCount()).toBe(0)
  })

  it('does not report notes that changed in the same batch', () => {
    const index = new DuplicateTitleIndex()
    expect(index.onChange({ inserted: [note('a', 'Plan'), note('b', 'Plan')] })).toEqual([])
    expect(index.duplicateCount()).toBe(2)
  })
})
