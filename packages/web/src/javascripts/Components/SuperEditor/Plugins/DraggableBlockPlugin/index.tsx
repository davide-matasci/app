/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { $createListNode, $isListNode } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, $getNodeByKey, $getRoot, LexicalEditor, LexicalNode } from 'lexical'
import { PointerEvent as ReactPointerEvent, TouchEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BlockIcon } from '@standardnotes/icons'

import { isHTMLElement } from '../../Lexical/Utils/guard'
import { Point } from '../../Lexical/Utils/point'
import { ContainsPointReturn, Rect } from '../../Lexical/Utils/rect'

const DRAGGABLE_BLOCK_MENU_LEFT_SPACE = -2
const TARGET_LINE_HALF_HEIGHT = 2
const DRAGGABLE_BLOCK_MENU_CLASSNAME = 'draggable-block-menu'
const TEXT_BOX_HORIZONTAL_PADDING = 24

const Downward = 1
const Upward = -1
const Indeterminate = 0

let prevIndex = Infinity

function getCurrentIndex(keysLength: number): number {
  if (keysLength === 0) {
    return Infinity
  }
  if (prevIndex >= 0 && prevIndex < keysLength) {
    return prevIndex
  }

  return Math.floor(keysLength / 2)
}

function getTopLevelNodeKeys(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() => $getRoot().getChildrenKeys())
}

function elementContainingEventLocation(
  anchorElem: HTMLElement,
  element: HTMLElement,
  eventLocation: Point,
): { contains: ContainsPointReturn; element: HTMLElement } {
  const anchorElementRect = anchorElem.getBoundingClientRect()

  const elementDomRect = Rect.fromDOM(element)
  const { marginTop, marginBottom } = window.getComputedStyle(element)

  const rect = elementDomRect.generateNewRect({
    bottom: elementDomRect.bottom + parseFloat(marginBottom),
    left: anchorElementRect.left,
    right: anchorElementRect.right,
    top: elementDomRect.top - parseFloat(marginTop),
  })

  const children = Array.from(element.children)

  const recursableTags = ['UL', 'OL', 'LI']
  const shouldRecurseIntoChildren = recursableTags.includes(element.tagName)

  if (shouldRecurseIntoChildren) {
    for (const child of children) {
      const isLeaf = child.children.length === 0
      if (isLeaf) {
        continue
      }
      if (!recursableTags.includes(child.tagName)) {
        continue
      }
      const childResult = elementContainingEventLocation(anchorElem, child as HTMLElement, eventLocation)

      if (childResult.contains.result) {
        return childResult
      }
    }
  }

  return { contains: rect.contains(eventLocation), element: element }
}

function getBlockElement(anchorElem: HTMLElement, editor: LexicalEditor, eventLocation: Point): HTMLElement | null {
  const topLevelNodeKeys = getTopLevelNodeKeys(editor)

  let blockElem: HTMLElement | null = null

  editor.getEditorState().read(() => {
    let index = getCurrentIndex(topLevelNodeKeys.length)
    let direction = Indeterminate

    while (index >= 0 && index < topLevelNodeKeys.length) {
      const key = topLevelNodeKeys[index]
      const elem = editor.getElementByKey(key)
      if (elem === null) {
        break
      }
      const { contains, element } = elementContainingEventLocation(anchorElem, elem, eventLocation)

      if (contains.result) {
        blockElem = element
        prevIndex = index
        break
      }

      if (direction === Indeterminate) {
        if (contains.reason.isOnTopSide) {
          direction = Upward
        } else if (contains.reason.isOnBottomSide) {
          direction = Downward
        } else {
          // stop search block element
          direction = Infinity
        }
      }

      index += direction
    }
  })

  return blockElem
}

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`)
}

function setMenuPosition(targetElem: HTMLElement | null, floatingElem: HTMLElement, anchorElem: HTMLElement) {
  if (!targetElem) {
    floatingElem.style.opacity = '0'
    return
  }

  const targetRect = targetElem.getBoundingClientRect()
  const targetStyle = window.getComputedStyle(targetElem)
  const floatingElemRect = floatingElem.getBoundingClientRect()
  const anchorElementRect = anchorElem.getBoundingClientRect()

  const top =
    targetRect.top + (parseInt(targetStyle.lineHeight, 10) - floatingElemRect.height) / 2 - anchorElementRect.top

  const left = DRAGGABLE_BLOCK_MENU_LEFT_SPACE

  floatingElem.style.opacity = '1'
  floatingElem.style.transform = `translate(${left}px, ${top}px)`
}

function setTargetLine(
  targetLineElem: HTMLElement,
  targetBlockElem: HTMLElement,
  mouseY: number,
  anchorElem: HTMLElement,
) {
  const targetStyle = window.getComputedStyle(targetBlockElem)
  const { top: targetBlockElemTop, height: targetBlockElemHeight } = targetBlockElem.getBoundingClientRect()
  const { top: anchorTop, width: anchorWidth } = anchorElem.getBoundingClientRect()

  let lineTop = targetBlockElemTop
  // At the bottom of the target
  if (mouseY - targetBlockElemTop > targetBlockElemHeight / 2) {
    lineTop += targetBlockElemHeight + parseFloat(targetStyle.marginBottom)
  } else {
    lineTop -= parseFloat(targetStyle.marginTop)
  }

  const top = lineTop - anchorTop - TARGET_LINE_HALF_HEIGHT
  const left = TEXT_BOX_HORIZONTAL_PADDING - DRAGGABLE_BLOCK_MENU_LEFT_SPACE

  targetLineElem.style.transform = `translate(${left}px, ${top}px)`
  targetLineElem.style.width = `${anchorWidth - (TEXT_BOX_HORIZONTAL_PADDING - DRAGGABLE_BLOCK_MENU_LEFT_SPACE) * 2}px`
  targetLineElem.style.opacity = '.6'
}

/** Every block a dragged block can be dropped before or after: top-level blocks, and list items within lists. */
function getDropTargetElements(editor: LexicalEditor): HTMLElement[] {
  const elements: HTMLElement[] = []
  for (const key of getTopLevelNodeKeys(editor)) {
    const element = editor.getElementByKey(key)
    if (!element) {
      continue
    }
    elements.push(element)
    if (element.tagName === 'UL' || element.tagName === 'OL') {
      elements.push(...Array.from(element.querySelectorAll<HTMLElement>('li')))
    }
  }
  return elements
}

/**
 * While dragging, draws a faint line at every place the block can be dropped (the active one is
 * the target line). Positions are taken once; scrolling the editor moves the whole set.
 */
function showGuideLines(container: HTMLElement, editor: LexicalEditor, anchorElem: HTMLElement) {
  const { top: anchorTop, width: anchorWidth } = anchorElem.getBoundingClientRect()
  const left = TEXT_BOX_HORIZONTAL_PADDING - DRAGGABLE_BLOCK_MENU_LEFT_SPACE
  const width = anchorWidth - left * 2

  const positions: number[] = []
  const addPosition = (top: number) => {
    if (!positions.some((existing) => Math.abs(existing - top) < 3)) {
      positions.push(top)
    }
  }
  for (const element of getDropTargetElements(editor)) {
    const { top, bottom } = element.getBoundingClientRect()
    const { marginTop, marginBottom } = window.getComputedStyle(element)
    addPosition(top - parseFloat(marginTop) - anchorTop)
    addPosition(bottom + parseFloat(marginBottom) - anchorTop)
  }

  container.replaceChildren(
    ...positions.map((top) => {
      const line = document.createElement('div')
      line.className = 'draggable-block-guide-line'
      line.style.transform = `translate(${left}px, ${top}px)`
      line.style.width = `${width}px`
      return line
    }),
  )
  container.style.transform = ''
}

function hideTargetLine(targetLineElem: HTMLElement | null) {
  if (targetLineElem) {
    targetLineElem.style.opacity = '0'
  }
}

function useDraggableBlockMenu(editor: LexicalEditor, anchorElem: HTMLElement, isEditable: boolean): JSX.Element {
  const scrollerElem = anchorElem.parentElement

  const menuRef = useRef<HTMLDivElement>(null)
  const targetLineRef = useRef<HTMLDivElement>(null)
  const guideLinesRef = useRef<HTMLDivElement>(null)
  /** The block being dragged, dimmed in place, and its scroll position when the drag began. */
  const dragStateRef = useRef<{ element: HTMLElement; opacity: string; scrollTop: number } | null>(null)
  const [draggableBlockElem, setDraggableBlockElem] = useState<HTMLElement | null>(null)
  const dragDataRef = useRef<string | null>(null)

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const target = event.target
      if (!isHTMLElement(target)) {
        setDraggableBlockElem(null)
        return
      }

      if (isOnMenu(target)) {
        return
      }

      const _draggableBlockElem = getBlockElement(anchorElem, editor, new Point(event.clientX, event.clientY))

      setDraggableBlockElem(_draggableBlockElem)
    }

    function onMouseLeave() {
      setDraggableBlockElem(null)
    }

    scrollerElem?.addEventListener('mousemove', onMouseMove)
    scrollerElem?.addEventListener('mouseleave', onMouseLeave)

    return () => {
      scrollerElem?.removeEventListener('mousemove', onMouseMove)
      scrollerElem?.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [scrollerElem, anchorElem, editor])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }
    setMenuPosition(draggableBlockElem, menu, anchorElem)

    // The note scrolls inside the editor, the handle's layer doesn't: follow the block on scroll too
    const rootElement = editor.getRootElement()
    if (!draggableBlockElem || !rootElement) {
      return
    }
    const followBlock = () => setMenuPosition(draggableBlockElem, menu, anchorElem)
    rootElement.addEventListener('scroll', followBlock, { passive: true })
    return () => rootElement.removeEventListener('scroll', followBlock)
  }, [anchorElem, draggableBlockElem, editor])

  const insertDraggedNode = useCallback(
    (draggedNode: LexicalNode, targetNode: LexicalNode, targetBlockElem: HTMLElement, pageY: number) => {
      let nodeToInsert = draggedNode
      const targetParent = targetNode.getParent()
      const sourceParent = draggedNode.getParent()

      if ($isListNode(sourceParent) && !$isListNode(targetParent)) {
        const newList = $createListNode(sourceParent.getListType())
        newList.append(draggedNode)
        nodeToInsert = newList
      }

      const { top, height } = targetBlockElem.getBoundingClientRect()
      const shouldInsertAfter = pageY - top > height / 2
      if (shouldInsertAfter) {
        targetNode.insertAfter(nodeToInsert)
      } else {
        targetNode.insertBefore(nodeToInsert)
      }
    },
    [],
  )

  /**
   * Dragging is done by hand with pointer events (mouse) and touch events, not with HTML5 drag and drop: Safari
   * never starts an HTML5 drag from the handle, so blocks couldn't be moved there at all.
   */
  const isMouseDraggingRef = useRef(false)

  function beginDrag(): boolean {
    if (!draggableBlockElem) {
      return false
    }
    const nodeKey = editor.read(() => $getNearestNodeFromDOMNode(draggableBlockElem)?.getKey())
    dragDataRef.current = nodeKey ?? null
    if (!nodeKey) {
      return false
    }

    dragStateRef.current = {
      element: draggableBlockElem,
      opacity: draggableBlockElem.style.opacity,
      scrollTop: editor.getRootElement()?.scrollTop ?? 0,
    }
    draggableBlockElem.style.opacity = '0.4'
    if (guideLinesRef.current) {
      showGuideLines(guideLinesRef.current, editor, anchorElem)
    }
    return true
  }

  function moveDrag(x: number, y: number): void {
    const rootElement = editor.getRootElement()
    if (rootElement) {
      const { top, bottom } = rootElement.getBoundingClientRect()
      const scrollOffset = 20
      if (y - top < scrollOffset) {
        rootElement.scrollTop -= scrollOffset
      } else if (bottom - y < scrollOffset) {
        rootElement.scrollTop += scrollOffset
      }
      const dragState = dragStateRef.current
      if (dragState && guideLinesRef.current) {
        guideLinesRef.current.style.transform = `translateY(${dragState.scrollTop - rootElement.scrollTop}px)`
      }
    }
    const targetBlockElem = getBlockElement(anchorElem, editor, new Point(x, y))
    const targetLineElem = targetLineRef.current
    if (targetBlockElem === null || targetLineElem === null) {
      return
    }
    setTargetLine(targetLineElem, targetBlockElem, y, anchorElem)
  }

  function endDrag(drop?: { x: number; y: number }): void {
    hideTargetLine(targetLineRef.current)
    guideLinesRef.current?.replaceChildren()
    const dragState = dragStateRef.current
    if (dragState) {
      dragState.element.style.opacity = dragState.opacity
      dragStateRef.current = null
    }

    const dragData = dragDataRef.current
    dragDataRef.current = null

    const targetBlockElem = drop ? getBlockElement(anchorElem, editor, new Point(drop.x, drop.y)) : null

    if (drop && dragData && targetBlockElem) {
      editor.update(() => {
        const draggedNode = $getNodeByKey(dragData)
        if (!draggedNode) {
          return
        }

        const targetNode = $getNearestNodeFromDOMNode(targetBlockElem)

        if (!targetNode) {
          return
        }
        if (targetNode === draggedNode) {
          return
        }

        insertDraggedNode(draggedNode, targetNode, targetBlockElem, drop.y)
      })
    }

    setDraggableBlockElem(null)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.pointerType === 'touch' || event.button !== 0) {
      return
    }
    if (!beginDrag()) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    isMouseDraggingRef.current = true
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isMouseDraggingRef.current) {
      moveDrag(event.clientX, event.clientY)
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!isMouseDraggingRef.current) {
      return
    }
    isMouseDraggingRef.current = false
    endDrag({ x: event.clientX, y: event.clientY })
  }

  function onPointerCancel(): void {
    if (!isMouseDraggingRef.current) {
      return
    }
    isMouseDraggingRef.current = false
    endDrag()
  }

  function onTouchStart(): void {
    beginDrag()
  }

  function onTouchMove(event: TouchEvent) {
    const { pageX, pageY } = event.targetTouches[0]
    moveDrag(pageX, pageY)
  }

  function onTouchEnd(event: TouchEvent): void {
    const { pageX, pageY } = event.changedTouches[0]
    endDrag({ x: pageX, y: pageY })
  }

  return createPortal(
    <>
      <div
        className="icon draggable-block-menu"
        ref={menuRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={isEditable ? 'icon' : ''}>
          <BlockIcon className="pointer-events-none text-text" />
        </div>
      </div>
      <div className="draggable-block-guide-lines" ref={guideLinesRef} />
      <div className="draggable-block-target-line" ref={targetLineRef} />
    </>,
    anchorElem,
  )
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement
}): JSX.Element {
  const [editor] = useLexicalComposerContext()
  return useDraggableBlockMenu(editor, anchorElem, editor._editable)
}
