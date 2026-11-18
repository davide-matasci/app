import { ContentType } from '@standardnotes/domain-core'
import {
  DecryptedPayload,
  FillItemContent,
  ImmutablePayloadCollection,
  NoteContent,
  PayloadCollection,
  PayloadSource,
  PayloadTimestampDefaults,
} from '@standardnotes/models'
import { UuidGenerator } from '@standardnotes/utils'
import { ServerSyncResponseResolver } from './ResponseResolver'

describe('ServerSyncResponseResolver', () => {
  UuidGenerator.SetGenerator(() => String(Math.random()))

  const note = (text: string, options: { dirty: boolean; source?: PayloadSource }) =>
    new DecryptedPayload(
      {
        uuid: 'note-uuid',
        content_type: ContentType.TYPES.Note,
        content: FillItemContent<NoteContent>({ title: 'Note', text }),
        dirty: options.dirty,
        ...PayloadTimestampDefaults(),
      },
      options.source,
    )

  const collectionOf = (payload: DecryptedPayload) => {
    const collection = new PayloadCollection()
    collection.set(payload)
    return ImmutablePayloadCollection.FromCollection(collection)
  }

  it('computes each step against the base it is given, so an edit made since the snapshot is kept', () => {
    const snapshot = collectionOf(note('Before', { dirty: false }))
    const current = collectionOf(note('Edited while the response was processed', { dirty: true }))
    const fromServer = note('Changed on another device', { dirty: false, source: PayloadSource.RemoteRetrieved })

    const resolver = new ServerSyncResponseResolver(
      { retrievedPayloads: [fromServer], savedPayloads: [], conflicts: {} },
      snapshot,
      [],
      {},
    )

    const retrievedFromSnapshot = resolver.result()[0].emits
    const retrievedFromCurrent = resolver.steps()[0](current).emits

    /** Against the old snapshot the server version silently replaces the note. */
    expect(retrievedFromSnapshot.map((payload) => payload.uuid)).toEqual(['note-uuid'])
    /** Against the current state the local edit is detected: a conflict copy keeps it. */
    expect(retrievedFromCurrent.length).toBeGreaterThan(1)
    expect(retrievedFromCurrent.some((payload) => payload.uuid !== 'note-uuid')).toBe(true)
  })
})
