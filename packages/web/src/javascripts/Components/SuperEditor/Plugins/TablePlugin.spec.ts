/**
 * @jest-environment jsdom
 */

import { createHeadlessEditor } from '@lexical/headless'
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { registerRemoveBrokenTables } from './TablePlugin'

describe('registerRemoveBrokenTables', () => {
  it('keeps a row left empty by a cell above that spans into it', () => {
    const editor = createHeadlessEditor({
      nodes: [TableNode, TableRowNode, TableCellNode],
      onError: (e) => {
        throw e
      },
    })
    registerRemoveBrokenTables(editor)

    const cell = (text: string) => {
      const node = $createTableCellNode(TableCellHeaderStates.NO_STATUS)
      node.append($createParagraphNode().append($createTextNode(text)))
      return node
    }

    editor.update(
      () => {
        const merged = cell('merged').setColSpan(3).setRowSpan(2)
        const table = $createTableNode().append(
          $createTableRowNode().append(merged),
          $createTableRowNode(),
          $createTableRowNode().append(cell('a'), cell('b'), cell('c')),
        )
        $getRoot().append(table)
      },
      { discrete: true },
    )

    const rowCount = editor.getEditorState().read(() => {
      const table = $getRoot().getChildren().find($isTableNode)
      return table ? table.getChildrenSize() : 0
    })
    expect(rowCount).toBe(3)
  })
})
