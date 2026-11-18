import { ContentType } from '@standardnotes/domain-core'
import { FillItemContent } from '../../Abstract/Content/ItemContent'
import { ConflictStrategy } from '../../Abstract/Item'
import {
  DecryptedPayload,
  DeletedPayload,
  EncryptedPayload,
  FullyFormedPayloadInterface,
  PayloadTimestampDefaults,
} from '../../Abstract/Payload'
import { ItemsKeyContent } from '../../Syncable/ItemsKey/ItemsKeyInterface'
import { NoteContent } from '../../Syncable/Note/NoteContent'
import { ImmutablePayloadCollection } from '../Collection/Payload/ImmutablePayloadCollection'
import { PayloadCollection } from '../Collection/Payload/PayloadCollection'
import { HistoryMap } from '../History'
import { ConflictDelta } from './Conflict'

describe('conflict delta', () => {
  const historyMap = {} as HistoryMap

  const createBaseCollection = (payload: FullyFormedPayloadInterface) => {
    const baseCollection = new PayloadCollection()
    baseCollection.set(payload)
    return ImmutablePayloadCollection.FromCollection(baseCollection)
  }

  const createDecryptedItemsKey = (uuid: string, key: string, timestamp = 0) => {
    return new DecryptedPayload<ItemsKeyContent>({
      uuid: uuid,
      content_type: ContentType.TYPES.ItemsKey,
      content: FillItemContent<ItemsKeyContent>({
        itemsKey: key,
      }),
      ...PayloadTimestampDefaults(),
      updated_at_timestamp: timestamp,
    })
  }

  const createErroredItemsKey = (uuid: string, timestamp = 0) => {
    return new EncryptedPayload({
      uuid: uuid,
      content_type: ContentType.TYPES.ItemsKey,
      content: '004:...',
      enc_item_key: '004:...',
      items_key_id: undefined,
      errorDecrypting: true,
      waitingForKey: false,
      ...PayloadTimestampDefaults(),
      updated_at_timestamp: timestamp,
    })
  }

  const createNote = (uuid: string, dirty: boolean) => {
    return new DecryptedPayload({
      uuid: uuid,
      content_type: ContentType.TYPES.Note,
      content: FillItemContent<NoteContent>({ title: 'Edited offline', text: 'Unsynced changes' }),
      dirty: dirty,
      ...PayloadTimestampDefaults(),
    })
  }

  const createDeletedNote = (uuid: string) => {
    return new DeletedPayload({
      uuid: uuid,
      content_type: ContentType.TYPES.Note,
      content: undefined,
      deleted: true,
      ...PayloadTimestampDefaults(),
      updated_at_timestamp: 2,
    })
  }

  it('if apply was deleted elsewhere while base has unsynced changes, should keep them as a conflict copy', () => {
    const basePayload = createNote('123', true)
    const delta = new ConflictDelta(createBaseCollection(basePayload), basePayload, createDeletedNote('123'), historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.DuplicateBaseKeepApply)
  })

  it('if apply was deleted and base has no unsynced changes, should just keep the deletion', () => {
    const basePayload = createNote('123', false)
    const delta = new ConflictDelta(createBaseCollection(basePayload), basePayload, createDeletedNote('123'), historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.KeepApply)
  })

  it('when apply is an items key, logic should be diverted to items key delta', () => {
    const basePayload = createDecryptedItemsKey('123', 'secret')

    const baseCollection = createBaseCollection(basePayload)

    const applyPayload = createDecryptedItemsKey('123', 'secret', 2)

    const delta = new ConflictDelta(baseCollection, basePayload, applyPayload, historyMap)

    const mocked = (delta.getConflictStrategy = jest.fn())

    delta.result()

    expect(mocked).toBeCalledTimes(0)
  })

  it('if apply payload is errored but base payload is not, should duplicate base and keep apply', () => {
    const basePayload = createDecryptedItemsKey('123', 'secret')

    const baseCollection = createBaseCollection(basePayload)

    const applyPayload = createErroredItemsKey('123', 2)

    const delta = new ConflictDelta(baseCollection, basePayload, applyPayload, historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.DuplicateBaseKeepApply)
  })

  it('if base payload is errored but apply is not, should keep base duplicate apply', () => {
    const basePayload = createErroredItemsKey('123', 2)

    const baseCollection = createBaseCollection(basePayload)

    const applyPayload = createDecryptedItemsKey('123', 'secret')

    const delta = new ConflictDelta(baseCollection, basePayload, applyPayload, historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.KeepBaseDuplicateApply)
  })

  it('if base and apply are errored, should keep apply', () => {
    const basePayload = createErroredItemsKey('123', 2)

    const baseCollection = createBaseCollection(basePayload)

    const applyPayload = createErroredItemsKey('123', 3)

    const delta = new ConflictDelta(baseCollection, basePayload, applyPayload, historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.KeepApply)
  })

  it('if keep base strategy, always use the apply payloads updated_at_timestamp', () => {
    const basePayload = createDecryptedItemsKey('123', 'secret', 2)

    const baseCollection = createBaseCollection(basePayload)

    const applyPayload = createDecryptedItemsKey('123', 'other secret', 1)

    const delta = new ConflictDelta(baseCollection, basePayload, applyPayload, historyMap)

    expect(delta.getConflictStrategy()).toBe(ConflictStrategy.KeepBaseDuplicateApply)

    const result = delta.result()

    expect(result.emits).toHaveLength(1)

    expect(result.emits[0].updated_at_timestamp).toEqual(applyPayload.updated_at_timestamp)
  })
})
