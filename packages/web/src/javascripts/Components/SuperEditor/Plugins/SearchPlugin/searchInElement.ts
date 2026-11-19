/**
 * Searches for a given query in an element and returns `Range`s for all the results.
 *
 * The text of all text nodes is joined into one string, so a result can span nodes
 * (e.g. across formatting). Matches are found with `indexOf` on that string and
 * mapped back to (node, offset) positions. Results don't overlap.
 */
export function searchInElement(element: HTMLElement, searchQuery: string, isCaseSensitive: boolean): Range[] {
  const ranges: Range[] = []

  if (!searchQuery) {
    return ranges
  }

  const query = isCaseSensitive ? searchQuery : searchQuery.toLowerCase()

  const nodes: { node: Node; start: number; length: number }[] = []
  let text = ''

  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const nodeText = node.textContent
    if (!nodeText) {
      continue
    }
    const comparableText = isCaseSensitive ? nodeText : nodeText.toLowerCase()
    nodes.push({ node, start: text.length, length: comparableText.length })
    text += comparableText
  }

  /** The node containing the character at `index`; with `isEnd`, the node a match ending before `index` ends in. */
  const positionAt = (index: number, isEnd: boolean): [Node, number] => {
    const entry = nodes.find(({ start, length }) => {
      const end = start + length
      return isEnd ? index > start && index <= end : index >= start && index < end
    })
    if (!entry) {
      throw new Error('Search position outside of text')
    }
    return [entry.node, index - entry.start]
  }

  for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + query.length)) {
    const range = new Range()
    range.setStart(...positionAt(index, false))
    range.setEnd(...positionAt(index + query.length, true))
    ranges.push(range)
  }

  return ranges
}
