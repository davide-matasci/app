import { ConflictParams, ConflictType } from '@standardnotes/responses'
import {
  ImmutablePayloadCollection,
  HistoryMap,
  DeltaRemoteRetrieved,
  DeltaRemoteSaved,
  DeltaRemoteDataConflicts,
  FullyFormedPayloadInterface,
  ServerSyncPushContextualPayload,
  ServerSyncSavedContextualPayload,
  DeltaRemoteUuidConflicts,
  DeltaRemoteRejected,
  DeltaEmit,
} from '@standardnotes/models'
import { DecryptedServerConflictMap } from './ServerConflictMap'

type PayloadSet = {
  retrievedPayloads: FullyFormedPayloadInterface[]
  savedPayloads: ServerSyncSavedContextualPayload[]
  conflicts: DecryptedServerConflictMap
}

/**
 * Given a remote sync response, the resolver applies the incoming changes on top
 * of the current base state, and returns what the new global state should look like.
 * The response resolver is purely functional and does not modify global state, but instead
 * offers the 'recommended' new global state given a sync response and a current base state.
 */
export class ServerSyncResponseResolver {
  constructor(
    private payloadSet: PayloadSet,
    private baseCollection: ImmutablePayloadCollection<FullyFormedPayloadInterface>,
    private payloadsSavedOrSaving: ServerSyncPushContextualPayload[],
    private historyMap: HistoryMap,
  ) {}

  public result(): DeltaEmit[] {
    return this.steps().map((step) => step(this.baseCollection))
  }

  /**
   * The same deltas, in the same order, each computed against the base collection it is
   * given. The caller passes the current local state right before applying each one, so
   * an edit saved while the response was being decrypted or an earlier step persisted is
   * seen (and kept dirty) instead of being overwritten by a result computed from an older
   * snapshot.
   */
  public steps(): ((base: ImmutablePayloadCollection<FullyFormedPayloadInterface>) => DeltaEmit)[] {
    return [
      (base) => this.processRetrievedPayloads(base),
      (base) => this.processSavedPayloads(base),
      (base) => this.processUuidConflictUnsavedPayloads(base),
      (base) => this.processDataConflictServerPayloads(base),
      (base) => this.processRejectedPayloads(base),
    ]
  }

  private processSavedPayloads(base: ImmutablePayloadCollection<FullyFormedPayloadInterface>): DeltaEmit {
    const delta = new DeltaRemoteSaved(base, this.payloadSet.savedPayloads)

    return delta.result()
  }

  private processRetrievedPayloads(base: ImmutablePayloadCollection<FullyFormedPayloadInterface>): DeltaEmit {
    const collection = ImmutablePayloadCollection.WithPayloads(this.payloadSet.retrievedPayloads)

    const delta = new DeltaRemoteRetrieved(base, collection, this.payloadsSavedOrSaving, this.historyMap)

    return delta.result()
  }

  private getConflictsForType<T extends ConflictParams<FullyFormedPayloadInterface>>(type: ConflictType): T[] {
    const results = this.payloadSet.conflicts[type] || []

    return results as T[]
  }

  private processDataConflictServerPayloads(base: ImmutablePayloadCollection<FullyFormedPayloadInterface>): DeltaEmit {
    const delta = new DeltaRemoteDataConflicts(
      base,
      this.getConflictsForType(ConflictType.ConflictingData),
      this.historyMap,
    )

    return delta.result()
  }

  private processUuidConflictUnsavedPayloads(base: ImmutablePayloadCollection<FullyFormedPayloadInterface>): DeltaEmit {
    const delta = new DeltaRemoteUuidConflicts(base, this.getConflictsForType(ConflictType.UuidConflict))

    return delta.result()
  }

  private processRejectedPayloads(base: ImmutablePayloadCollection<FullyFormedPayloadInterface>): DeltaEmit {
    const conflicts = [
      ...this.getConflictsForType(ConflictType.ContentTypeError),
      ...this.getConflictsForType(ConflictType.ContentError),
      ...this.getConflictsForType(ConflictType.ReadOnlyError),
      ...this.getConflictsForType(ConflictType.UuidError),
      ...this.getConflictsForType(ConflictType.SharedVaultSnjsVersionError),
      ...this.getConflictsForType(ConflictType.SharedVaultInsufficientPermissionsError),
      ...this.getConflictsForType(ConflictType.SharedVaultNotMemberError),
      ...this.getConflictsForType(ConflictType.SharedVaultInvalidState),
      ...this.getConflictsForType(ConflictType.InvalidServerItem),
    ]

    const delta = new DeltaRemoteRejected(base, conflicts)
    const result = delta.result()
    return result
  }
}
