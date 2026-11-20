/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  INSERT_TABLE_COMMAND,
  TableNode,
  TableRowNode,
} from '@lexical/table'
import { $createParagraphNode, LexicalEditor } from 'lexical'
import { useCallback, useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import DecoratedInput from '@/Components/Input/DecoratedInput'
import Button from '@/Components/Button/Button'
import { isMobileScreen } from '../../../Utils'
import { c } from 'ttag'

export function InsertTableDialog({
  activeEditor,
  onClose,
}: {
  activeEditor: LexicalEditor
  onClose: () => void
}): JSX.Element {
  const [rows, setRows] = useState('5')
  const [columns, setColumns] = useState('5')

  const onClick = () => {
    activeEditor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows })
    onClose()
  }

  const focusOnMount = useCallback((element: HTMLInputElement | null) => {
    if (element) {
      setTimeout(() => element.focus())
    }
  }, [])

  return (
    <>
      <label className="mb-2.5 flex items-center justify-between gap-3">
        {c('B3.Notes.EditorToolbar.Label').t`Rows:`}
        <DecoratedInput type="number" value={rows} onChange={setRows} ref={focusOnMount} />
      </label>
      <label className="mb-2.5 flex items-center justify-between gap-3">
        {c('B3.Notes.EditorToolbar.Label').t`Columns:`}
        <DecoratedInput type="number" value={columns} onChange={setColumns} />
      </label>
      <div className="flex justify-end">
        <Button onClick={onClick} small={isMobileScreen()}>
          {c('B3.Notes.EditorToolbar.Action').t`Confirm`}
        </Button>
      </div>
    </>
  )
}

/**
 * Sometimes copy/pasting tables from other sources can result
 * in adding extra table nodes which don't have any children.
 * This causes an error when copying the table or exporting the
 * note as HTML.
 * This plugin removes any tables which don't have any children.
 */
export function RemoveBrokenTablesPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => registerRemoveBrokenTables(editor), [editor])

  return null
}

export function registerRemoveBrokenTables(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerNodeTransform(TableRowNode, (node) => {
      if (!node.getFirstChild() && !isCoveredByRowSpan(node)) {
        node.remove()
      }
    }),
    editor.registerNodeTransform(TableNode, (node) => {
      if (!node.getFirstChild()) {
        node.remove()
      }
      const hasNextSibling = !!node.getNextSibling()
      const hasPreviousSibling = !!node.getPreviousSibling()
      if (!node.getParent()) {
        return
      }
      if (!hasNextSibling) {
        node.insertAfter($createParagraphNode())
      } else if (!hasPreviousSibling) {
        node.insertBefore($createParagraphNode())
      }
    }),
  )
}

/**
 * A row left without cells by a merge is still part of the table: the merged cell above spans into it. Removing it
 * made the table pad itself with extra cells (merging two full rows of a 3x3 table gave a 6-column table).
 */
function isCoveredByRowSpan(row: TableRowNode): boolean {
  const table = row.getParent()
  if (!$isTableNode(table)) {
    return false
  }
  const rows = table.getChildren()
  const rowIndex = rows.indexOf(row)
  return rows
    .slice(0, rowIndex)
    .some(
      (earlierRow, earlierIndex) =>
        $isTableRowNode(earlierRow) &&
        earlierRow.getChildren().some((cell) => $isTableCellNode(cell) && earlierIndex + cell.getRowSpan() > rowIndex),
    )
}
