import { ContentType } from '@standardnotes/domain-core'
import { BrokenLinkIndex } from './BrokenLinkIndex'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const FILE = '33333333-3333-4333-8333-333333333333'

const superText = (...nodes: string[]) => `{"root":{"children":[{"children":[${nodes.join(',')}],"type":"paragraph"}]}}`
const bubble = (uuid: string) => `{"type":"snbubble","version":1,"itemUuid":"${uuid}"}`
const file = (uuid: string) => `{"type":"snfile","version":1,"format":"","fileUuid":"${uuid}"}`

const note = (uuid: string, text: string, extra: Record<string, unknown> = {}) =>
  ({ uuid, content_type: ContentType.TYPES.Note, noteType: 'super', text, ...extra }) as never
const item = (uuid: string, content_type: string = ContentType.TYPES.Note) => ({ uuid, content_type }) as never

describe('BrokenLinkIndex', () => {
  let existing: Set<string>
  let index: BrokenLinkIndex

  beforeEach(() => {
    existing = new Set<string>()
    index = new BrokenLinkIndex((uuid) => existing.has(uuid))
  })

  const insert = (...items: never[]) => {
    for (const inserted of items as unknown as { uuid: string }[]) {
      existing.add(inserted.uuid)
    }
    return index.onChange({ inserted: items })
  }
  const discard = (uuid: string) => {
    existing.delete(uuid)
    return index.onChange({ discarded: [{ uuid } as never] })
  }

  it('reads the linked notes and files of a Super note', () => {
    expect(BrokenLinkIndex.linkedUuids(superText(bubble(A), file(FILE), bubble(A)))).toEqual([A, FILE])
    expect(BrokenLinkIndex.linkedUuids(superText())).toEqual([])
    expect(BrokenLinkIndex.linkedUuids(undefined)).toEqual([])
  })

  it('counts a note whose linked note or file does not exist', () => {
    insert(
      item(A),
      note('n1', superText(bubble(A))),
      note('n2', superText(bubble(B))),
      note('n3', superText(file(FILE))),
    )

    expect(index.hasBrokenLink('n1')).toBe(false)
    expect(index.hasBrokenLink('n2')).toBe(true)
    expect(index.hasBrokenLink('n3')).toBe(true)
    expect(index.brokenCount()).toBe(2)
  })

  it('reports the linking note when the linked item is deleted, and when it arrives later', () => {
    insert(item(A), note('n1', superText(bubble(A))))
    expect(index.brokenCount()).toBe(0)

    expect(discard(A)).toEqual(['n1'])
    expect(index.hasBrokenLink('n1')).toBe(true)

    // e.g. the linked note is loaded or synced after the note that links to it
    expect(insert(item(A))).toEqual(['n1'])
    expect(index.brokenCount()).toBe(0)
  })

  it('updates when the link is removed from the note, or the note is trashed, archived or deleted', () => {
    insert(note('n1', superText(bubble(B))), note('n2', superText(bubble(B))), note('n3', superText(bubble(B))))
    expect(index.brokenCount()).toBe(3)

    expect(index.onChange({ changed: [note('n1', superText())] })).toEqual(['n1'])
    expect(index.onChange({ changed: [note('n2', superText(bubble(B)), { trashed: true })] })).toEqual(['n2'])
    expect(index.onChange({ changed: [note('n3', superText(bubble(B)), { archived: true })] })).toEqual(['n3'])
    expect(index.brokenCount()).toBe(0)

    expect(index.onChange({ changed: [note('n2', superText(bubble(B)))] })).toEqual(['n2'])
    expect(discard('n2')).toEqual(['n2'])
    expect(index.brokenCount()).toBe(0)
  })

  it('ignores text that looks like a link in notes that are not Super notes', () => {
    insert(note('plain', superText(bubble(B)), { noteType: 'plain-text' }))
    expect(index.brokenCount()).toBe(0)
  })

  it('reports nothing when nothing relevant changes', () => {
    insert(item(A), note('n1', superText(bubble(A))))
    expect(index.onChange({ changed: [note('n1', superText(bubble(A)))] })).toEqual([])
    expect(index.onChange({ changed: [item(A)] })).toEqual([])
  })
})
