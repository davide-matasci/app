import { NoteContent, NoteMutator, NoteType } from '@standardnotes/snjs'
import { restoreRevisionContent } from './NoteHistoryController'

describe('restoreRevisionContent', () => {
  it('restores title, text and editor, and keeps protection, links and flags', () => {
    const note = {
      title: 'Current',
      text: 'Current text',
      protected: true,
      pinned: true,
      references: [{ uuid: 'linked-note', content_type: 'Note' }],
    } as Record<string, unknown>

    const revision = {
      title: 'Old title',
      text: 'Old text',
      preview_plain: 'Old text',
      noteType: NoteType.Plain,
      editorIdentifier: undefined,
      protected: false,
      pinned: false,
      references: [],
    } as unknown as NoteContent

    restoreRevisionContent(note as unknown as NoteMutator, revision)

    expect(note.title).toBe('Old title')
    expect(note.text).toBe('Old text')
    expect(note.protected).toBe(true)
    expect(note.pinned).toBe(true)
    expect(note.references).toEqual([{ uuid: 'linked-note', content_type: 'Note' }])
  })
})
