import { MutationType, NoteMutator, SNNote } from '@standardnotes/models'
import {
  AlertService,
  InfoStrings,
  ItemManagerInterface,
  MutatorClientInterface,
  SessionsClientInterface,
  SyncMode,
  SyncServiceInterface,
} from '@standardnotes/snjs'
import { Deferred } from '@standardnotes/utils'
import { EditorSaveTimeoutDebounce } from '../Components/NoteView/Controller/EditorSaveTimeoutDebounce'
import { IsNativeMobileWeb } from '@standardnotes/ui-services'
import { LargeNoteThreshold } from '@/Constants/Constants'
import { NoteStatus } from '@/Components/NoteView/NoteStatusIndicator'
import { action, makeObservable, observable, runInAction } from 'mobx'
import { c } from 'ttag'

const NotePreviewCharLimit = 160
const MinimumStatusChangeDuration = 400

export type NoteSaveFunctionParams = {
  title?: string
  text?: string
  bypassDebouncer?: boolean
  isUserModified?: boolean
  dontGeneratePreviews?: boolean
  previews?: { previewPlain: string; previewHtml?: string }
  customMutate?: (mutator: NoteMutator) => void
  onLocalPropagationComplete?: () => void
}

export class NoteSyncController {
  savingLocallyPromise: ReturnType<typeof Deferred<void>> | null = null

  private syncTimeout?: ReturnType<typeof setTimeout>
  /** All changes since the last save: a title save and a text save must not cancel each other. */
  private pendingSave?: { params: NoteSaveFunctionParams; isLargeNote: boolean; resolvers: (() => void)[] }
  private largeNoteSyncTimeout?: ReturnType<typeof setTimeout>
  private statusChangeTimeout?: ReturnType<typeof setTimeout>

  status: NoteStatus | undefined = undefined

  constructor(
    private item: SNNote,
    private items: ItemManagerInterface,
    private mutator: MutatorClientInterface,
    private sessions: SessionsClientInterface,
    private sync: SyncServiceInterface,
    private alerts: AlertService,
    private _isNativeMobileWeb: IsNativeMobileWeb,
  ) {
    makeObservable(this, {
      status: observable,
      setStatus: action,
    })

    window.addEventListener('pagehide', this.flushOnPageLeave)
    document.addEventListener('visibilitychange', this.flushOnPageLeave)
  }

  /**
   * Closing or reloading the tab, quitting the app or sending it to the background must
   * not wait for the save debounce: save what was typed right away.
   */
  private flushOnPageLeave = (event: Event) => {
    if (event.type === 'pagehide' || document.visibilityState === 'hidden') {
      this.flushPendingSave()
    }
  }

  setStatus(status: NoteStatus, wait = true) {
    if (this.statusChangeTimeout) {
      clearTimeout(this.statusChangeTimeout)
    }
    if (wait) {
      this.statusChangeTimeout = setTimeout(() => {
        runInAction(() => {
          this.status = status
        })
      }, MinimumStatusChangeDuration)
    } else {
      this.status = status
    }
  }

  showSavingStatus() {
    this.setStatus(
      {
        type: 'saving',
        message: c('B5.SecuritySync.Sync.Status').t`Saving…`,
      },
      false,
    )
  }

  showAllChangesSavedStatus() {
    this.setStatus({
      type: 'saved',
      message: this.sessions.isSignedOut()
        ? (c('B3.Notes.NoteActions.Status').jt`All changes saved offline` as unknown as string)
        : c('B3.Notes.NoteActions.Status').t`All changes saved`,
    })
  }

  showWaitingToSyncLargeNoteStatus() {
    this.setStatus(
      {
        type: 'waiting',
        message: c('B3.Notes.NoteActions.Status').t`Note is too large`,
        description: c('B3.Notes.NoteActions.Info')
          .t`It will be synced less often. Changes will be saved offline normally.`,
      },
      false,
    )
  }

  showErrorStatus(error?: NoteStatus) {
    if (!error) {
      error = {
        type: 'error',
        message: c('B3.Notes.NoteActions.Error').t`Sync Unreachable`,
        description: c('B3.Notes.NoteActions.Status').t`Changes saved offline`,
      }
    }
    this.setStatus(error)
  }

  setItem(item: SNNote) {
    this.item = item
  }

  deinit() {
    window.removeEventListener('pagehide', this.flushOnPageLeave)
    document.removeEventListener('visibilitychange', this.flushOnPageLeave)

    /** Closing the note (switching notes) must save what was typed, not drop it. */
    const hadPendingSave = this.pendingSave !== undefined
    this.flushPendingSave()
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }
    if (this.largeNoteSyncTimeout) {
      clearTimeout(this.largeNoteSyncTimeout)
    }
    if (this.statusChangeTimeout) {
      clearTimeout(this.statusChangeTimeout)
    }
    /** A flushed save resolves it when stored; only an unfinished one is rejected. */
    if (this.savingLocallyPromise && !hadPendingSave) {
      this.savingLocallyPromise.reject()
    }
    this.savingLocallyPromise = null
    this.largeNoteSyncTimeout = undefined
    this.syncTimeout = undefined
    this.status = undefined
    this.statusChangeTimeout = undefined
    ;(this.item as unknown) = undefined
  }

  private isLargeNote(text: string): boolean {
    const textByteSize = new Blob([text]).size
    return textByteSize > LargeNoteThreshold
  }

  public async saveAndAwaitLocalPropagation(params: NoteSaveFunctionParams): Promise<void> {
    this.savingLocallyPromise = Deferred<void>()

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    const noDebounce = params.bypassDebouncer || this.sessions.isSignedOut()
    const syncDebounceMs = noDebounce
      ? EditorSaveTimeoutDebounce.ImmediateChange
      : this._isNativeMobileWeb.execute().getValue()
      ? EditorSaveTimeoutDebounce.NativeMobileWeb
      : EditorSaveTimeoutDebounce.Desktop

    return new Promise((resolve) => {
      const mergedParams = mergeSaveParams(this.pendingSave?.params, params)
      const isLargeNote = this.isLargeNote(mergedParams.text ? mergedParams.text : this.item.text)

      if (isLargeNote) {
        this.showWaitingToSyncLargeNoteStatus()
        this.queueLargeNoteSyncIfNeeded()
      }

      this.pendingSave = {
        params: mergedParams,
        isLargeNote,
        resolvers: [...(this.pendingSave?.resolvers ?? []), resolve],
      }

      this.syncTimeout = setTimeout(() => this.flushPendingSave(), syncDebounceMs)
    })
  }

  /** Saves the pending changes now, if any (note closed, page hidden or closing). */
  public flushPendingSave(): void {
    const pending = this.pendingSave
    if (!pending) {
      return
    }

    this.pendingSave = undefined
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = undefined
    }

    const savingLocallyPromise = this.savingLocallyPromise
    void this.undebouncedMutateAndSync(this.item, {
      ...pending.params,
      localOnly: pending.isLargeNote,
      onLocalPropagationComplete: () => {
        savingLocallyPromise?.resolve()
        pending.resolvers.forEach((resolve) => resolve())
      },
    })
  }

  private queueLargeNoteSyncIfNeeded(): void {
    const isAlreadyAQueuedLargeNoteSync = this.largeNoteSyncTimeout !== undefined

    if (!isAlreadyAQueuedLargeNoteSync) {
      const isSignedIn = this.sessions.isSignedIn()
      const timeout = isSignedIn ? EditorSaveTimeoutDebounce.LargeNote : EditorSaveTimeoutDebounce.ImmediateChange

      this.largeNoteSyncTimeout = setTimeout(() => {
        this.largeNoteSyncTimeout = undefined
        void this.performSyncOfLargeItem()
      }, timeout)
    }
  }

  private async performSyncOfLargeItem(): Promise<void> {
    const item = this.items.findItem(this.item.uuid)
    if (!item || !item.dirty) {
      return
    }

    void this.sync.sync()
  }

  private async undebouncedMutateAndSync(
    item: SNNote,
    params: NoteSaveFunctionParams & { localOnly: boolean },
  ): Promise<void> {
    if (!this.items.findItem(item.uuid)) {
      void this.alerts.alert(InfoStrings.InvalidNote)
      return
    }

    await this.mutator.changeItem(
      item,
      (mutator) => {
        const noteMutator = mutator as NoteMutator
        if (params.customMutate) {
          params.customMutate(noteMutator)
        }

        if (params.title != undefined) {
          noteMutator.title = params.title
        }

        if (params.text != undefined) {
          noteMutator.text = params.text
        }

        if (params.previews) {
          noteMutator.preview_plain = params.previews.previewPlain
          noteMutator.preview_html = params.previews.previewHtml
        } else if (!params.dontGeneratePreviews && params.text != undefined) {
          const noteText = params.text || ''
          const truncate = noteText.length > NotePreviewCharLimit
          const substring = noteText.substring(0, NotePreviewCharLimit)
          const previewPlain = substring + (truncate ? '...' : '')
          noteMutator.preview_plain = previewPlain
          noteMutator.preview_html = undefined
        }
      },
      params.isUserModified ? MutationType.UpdateUserTimestamps : MutationType.NoUpdateUserTimestamps,
    )

    void this.sync.sync({ mode: params.localOnly ? SyncMode.LocalOnly : undefined })

    /** Flushed by deinit (note closed): the item is gone, nothing more to queue. */
    if (this.item) {
      this.queueLargeNoteSyncIfNeeded()
    }

    params.onLocalPropagationComplete?.()
  }

  public syncOnlyIfLargeNote(): void {
    const isLargeNote = this.isLargeNote(this.item.text)
    if (isLargeNote) {
      void this.performSyncOfLargeItem()
    }
  }
}

/**
 * Combines a pending save with a newer one: the newer value of each field wins, and a
 * field only the pending save set (e.g. the title, when the newer save is for the text)
 * is kept.
 */
export function mergeSaveParams(
  pending: NoteSaveFunctionParams | undefined,
  next: NoteSaveFunctionParams,
): NoteSaveFunctionParams {
  if (!pending) {
    return next
  }

  const nextSetsText = next.text != undefined
  const customMutates = [pending.customMutate, next.customMutate].filter(
    (mutate): mutate is (mutator: NoteMutator) => void => mutate != undefined,
  )

  return {
    ...pending,
    ...next,
    title: next.title ?? pending.title,
    text: next.text ?? pending.text,
    previews: nextSetsText ? next.previews : pending.previews,
    dontGeneratePreviews: nextSetsText ? next.dontGeneratePreviews : pending.dontGeneratePreviews,
    isUserModified: pending.isUserModified || next.isUserModified,
    customMutate:
      customMutates.length > 0 ? (mutator) => customMutates.forEach((mutate) => mutate(mutator)) : undefined,
  }
}
