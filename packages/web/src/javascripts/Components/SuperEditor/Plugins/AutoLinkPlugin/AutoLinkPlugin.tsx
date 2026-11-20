/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { URL_REGEX, EMAIL_REGEX } from '@/Constants/Constants'
import { AutoLinkPlugin, LinkMatcher } from '@lexical/react/LexicalAutoLinkPlugin'

/** EMAIL_REGEX without its ^…$ anchors: it must find an email inside a sentence, not only as the whole text. */
const EMAIL_IN_TEXT_REGEX = new RegExp(EMAIL_REGEX.source.replace(/^\^/, '').replace(/\$$/, ''))

/**
 * Trailing punctuation belongs to the sentence, not the URL ("see https://example.com/page." or
 * "(https://en.wikipedia.org/wiki/Foo)"); a closing parenthesis stays when it closes one inside the URL.
 */
export function trimUrlMatch(url: string): string {
  let trimmed = url
  for (;;) {
    const last = trimmed.slice(-1)
    if ('.,;:!?\'"'.includes(last) && last !== '') {
      trimmed = trimmed.slice(0, -1)
    } else if (last === ')' && (trimmed.match(/\(/g) ?? []).length < (trimmed.match(/\)/g) ?? []).length) {
      trimmed = trimmed.slice(0, -1)
    } else {
      return trimmed
    }
  }
}

export const urlMatcher: LinkMatcher = (text) => {
  const match = URL_REGEX.exec(text)
  if (!match) {
    return null
  }
  const url = trimUrlMatch(match[0])
  return {
    index: match.index,
    length: url.length,
    text: url,
    url: url.startsWith('http') ? url : `https://${url}`,
  }
}

export const emailMatcher: LinkMatcher = (text) => {
  const match = EMAIL_IN_TEXT_REGEX.exec(text)
  if (!match) {
    return null
  }
  return { index: match.index, length: match[0].length, text: match[0], url: `mailto:${match[0]}` }
}

const MATCHERS = [urlMatcher, emailMatcher]

export default function LexicalAutoLinkPlugin(): JSX.Element {
  return <AutoLinkPlugin matchers={MATCHERS} />
}
