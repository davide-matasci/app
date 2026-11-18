import { NoteMutator, SNNote } from '@standardnotes/models'
import {
  AlertService,
  ItemManagerInterface,
  MutatorClientInterface,
  SessionsClientInterface,
  SyncServiceInterface,
} from '@standardnotes/snjs'
import { IsNativeMobileWeb } from '@standardnotes/ui-services'
import { NoteSyncController, mergeSaveParams } from './NoteSyncController'

describe('NoteSyncController', () => {
  let saved: Partial<Record<'title' | 'text', string>>[]
  let controller: NoteSyncController

  const note = { uuid: 'note-uuid', title: 'Old title', text: 'Old text' } as SNNote

  beforeEach(() => {
    jest.useFakeTimers()
    saved = []

    const items = { findItem: jest.fn().mockReturnValue(note) } as unknown as ItemManagerInterface
    const mutator = {
      changeItem: jest.fn().mockImplementation(async (_item, mutate: (mutator: NoteMutator) => void) => {
        const fields: Partial<Record<'title' | 'text', string>> = {}
        mutate(fields as unknown as NoteMutator)
        saved.push({ title: fields.title, text: fields.text })
      }),
    } as unknown as MutatorClientInterface
    const sessions = { isSignedOut: () => false, isSignedIn: () => true } as unknown as SessionsClientInterface
    const sync = { sync: jest.fn().mockResolvedValue(undefined) } as unknown as SyncServiceInterface
    const isNativeMobileWeb = { execute: () => ({ getValue: () => false }) } as unknown as IsNativeMobileWeb

    controller = new NoteSyncController(note, items, mutator, sessions, sync, {} as AlertService, isNativeMobileWeb)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps a title saved just before a text save, as one save', async () => {
    const titleSaved = controller.saveAndAwaitLocalPropagation({ title: 'New title' })
    const textSaved = controller.saveAndAwaitLocalPropagation({ text: 'New text' })

    await jest.runAllTimersAsync()
    await Promise.all([titleSaved, textSaved])

    expect(saved).toEqual([{ title: 'New title', text: 'New text' }])
  })

  it('saves a pending edit when the note is closed instead of dropping it', async () => {
    void controller.saveAndAwaitLocalPropagation({ text: 'Typed just before switching notes' })

    controller.deinit()
    await Promise.resolve()

    expect(saved).toEqual([{ title: undefined, text: 'Typed just before switching notes' }])
  })

  it('saves a pending edit right away when the page is hidden', async () => {
    void controller.saveAndAwaitLocalPropagation({ text: 'Typed just before closing the tab' })

    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(saved).toEqual([{ title: undefined, text: 'Typed just before closing the tab' }])
    controller.deinit()
  })

  describe('mergeSaveParams', () => {
    it('lets newer fields win and chains custom mutations', () => {
      const calls: string[] = []
      const merged = mergeSaveParams(
        { title: 'a', text: 'x', isUserModified: true, customMutate: () => calls.push('first') },
        { text: 'y', customMutate: () => calls.push('second') },
      )

      merged.customMutate?.({} as NoteMutator)

      expect(merged.title).toBe('a')
      expect(merged.text).toBe('y')
      expect(merged.isUserModified).toBe(true)
      expect(calls).toEqual(['first', 'second'])
    })
  })
})
