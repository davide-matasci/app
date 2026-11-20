import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  ElementFormatType,
  NodeKey,
  SKIP_DOM_SELECTION_TAG,
} from 'lexical'
import { useApplication } from '@/Components/ApplicationProvider'
import FilePreview from '@/Components/FilePreview/FilePreview'
import { ApplicationEvent, ContentType, FileItem } from '@standardnotes/snjs'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { observer } from 'mobx-react-lite'
import Spinner from '@/Components/Spinner/Spinner'
import { FilesControllerEvent } from '@/Controllers/FilesController'
import { c } from 'ttag'

function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]') !== null
}

export type FileComponentProps = Readonly<{
  className: Readonly<{
    base: string
    focus: string
  }>
  format: ElementFormatType | null
  setFormat: (format: ElementFormatType) => void
  nodeKey: NodeKey
  fileUuid: string
  zoomLevel: number
  setZoomLevel: (zoomLevel: number) => void
}>

function FileComponent({
  className,
  format,
  setFormat,
  nodeKey,
  fileUuid,
  zoomLevel,
  setZoomLevel,
}: FileComponentProps) {
  const application = useApplication()
  const [editor] = useLexicalComposerContext()
  const [file, setFile] = useState(() => application.items.findItem<FileItem>(fileUuid))
  /** Looked up live: the file can arrive after the note opens (batched local load, sync); see BubbleComponent. */
  useEffect(() => {
    setFile(application.items.findItem<FileItem>(fileUuid))
    return application.items.streamItems(ContentType.TYPES.File, () =>
      setFile(application.items.findItem<FileItem>(fileUuid)),
    )
  }, [application, fileUuid])
  const [isDatabaseLoaded, setIsDatabaseLoaded] = useState(() => application.sync.isDatabaseLoaded())
  useEffect(() => {
    if (isDatabaseLoaded) {
      return
    }
    return application.addEventObserver(async (event) => {
      if (event === ApplicationEvent.LocalDataLoaded) {
        setIsDatabaseLoaded(true)
      }
    })
  }, [application, isDatabaseLoaded])
  const uploadProgress = application.filesController.uploadProgressMap.get(fileUuid)

  const [canLoad, setCanLoad] = useState(false)

  const blockWrapperRef = useRef<HTMLDivElement>(null)
  const blockObserver = useMemo(
    () =>
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setCanLoad(true)
            }
          })
        },
        {
          threshold: 0.25,
        },
      ),
    [],
  )

  useEffect(() => {
    const wrapper = blockWrapperRef.current

    if (!wrapper) {
      return
    }

    blockObserver.observe(wrapper)

    return () => {
      blockObserver.unobserve(wrapper)
    }
  }, [blockObserver])

  const setImageZoomLevel = useCallback(
    (zoomLevel: number) => {
      editor.update(() => {
        setZoomLevel(zoomLevel)
      })
    },
    [editor, setZoomLevel],
  )

  const changeAlignment = useCallback(
    (alignment: ElementFormatType) =>
      editor.update(
        () => {
          setFormat(alignment)
        },
        {
          tag: SKIP_DOM_SELECTION_TAG,
        },
      ),
    [editor, setFormat],
  )

  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey)

  useEffect(() => {
    return editor.registerCommand<MouseEvent>(
      CLICK_COMMAND,
      (event) => {
        if (blockWrapperRef.current?.contains(event.target as Node)) {
          if (isInteractiveClickTarget(event.target)) {
            return false
          }

          event.preventDefault()

          $getNodeByKey(nodeKey)?.selectEnd()

          setTimeout(() => {
            setSelected(!isSelected)
          })
          return true
        }

        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, isSelected, nodeKey, setSelected])

  useEffect(() => {
    return application.filesController.addEventObserver((event, data) => {
      if (event === FilesControllerEvent.FileUploadFinished && data[FilesControllerEvent.FileUploadFinished]) {
        const { uploadedFile } = data[FilesControllerEvent.FileUploadFinished]
        if (uploadedFile.uuid === fileUuid) {
          setFile(uploadedFile)
        }
      }
    })
  }, [application.filesController, fileUuid])

  if (uploadProgress && (uploadProgress.progress < 100 || !file)) {
    const progress = uploadProgress.progress
    return (
      <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center" ref={blockWrapperRef}>
          <div className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            {c('B4.Notes.EditingUI.Status').jt`Uploading file "${uploadProgress.file.name}" (${progress}%)`}
          </div>
          <div className="w-full max-w-[50%] overflow-hidden rounded bg-contrast">
            <div
              className="h-2 rounded rounded-tl-none bg-info transition-[width] duration-100"
              role="progressbar"
              style={{
                width: `${progress}%`,
              }}
              aria-valuenow={progress}
            />
          </div>
        </div>
      </BlockWithAlignableContents>
    )
  }

  if (!file && !isDatabaseLoaded) {
    return (
      <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
        <div className="text-passive-1">{c('B4.Notes.EditingUI.Info').t`Loading…`}</div>
      </BlockWithAlignableContents>
    )
  }

  if (!file) {
    return (
      <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
        <div className="text-passive-1" title={fileUuid}>
          {c('B4.Notes.EditingUI.Label').t`This file was deleted.`}
        </div>
      </BlockWithAlignableContents>
    )
  }

  return (
    <BlockWithAlignableContents className={className} format={format} nodeKey={nodeKey}>
      <div ref={blockWrapperRef}>
        {canLoad && (
          <FilePreview
            isEmbeddedInSuper={true}
            file={file}
            application={application}
            imageZoomLevel={zoomLevel}
            setImageZoomLevel={setImageZoomLevel}
            alignment={format}
            changeAlignment={changeAlignment}
          />
        )}
      </div>
    </BlockWithAlignableContents>
  )
}

export default observer(FileComponent)
