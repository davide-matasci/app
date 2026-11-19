/**
 * @jest-environment jsdom
 */

import { HeadlessSuperConverter } from './HeadlessSuperConverter'
import { EvernoteConverter } from '@standardnotes/ui-services/src/Import/EvernoteConverter/EvernoteConverter'
import { checkboxEnex, highlightEnex } from '@standardnotes/ui-services/src/Import/EvernoteConverter/testData'
import { GenerateUuid } from '@standardnotes/services'
import { PureCryptoInterface } from '@standardnotes/sncrypto-common'

describe('HeadlessSuperConverter', () => {
  it('imports mark tags as highlight format', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString('<p><mark>Line 2</mark></p>', 'html', {
      html: {
        addLineBreaks: false,
      },
    })

    expect(superString).toContain('"format":128')
  })

  it('imports Evernote highlight spans as highlight format with background color', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString(
      '<p><span style="--en-highlight:yellow;background-color: #ffef9e;">Line 2</span></p>',
      'html',
      {
        html: {
          addLineBreaks: false,
        },
      },
    )

    expect(superString).toContain('"format":128')
    expect(superString).toContain('background-color')
  })

  it('imports legacy -evernote-highlight spans as highlight format', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString(
      '<p><span style="background-color: rgb(255, 250, 165);-evernote-highlight:true;">Line 2</span></p>',
      'html',
      {
        html: {
          addLineBreaks: false,
        },
      },
    )

    expect(superString).toContain('"format":128')
  })

  it('imports Evernote checkbox lists as check list type', async () => {
    const crypto = {
      generateUUID: () => String(Math.random()),
    } as unknown as PureCryptoInterface
    const generateUuid = new GenerateUuid(crypto)
    const superConverter = new HeadlessSuperConverter()
    const evernoteConverter = new EvernoteConverter(generateUuid)

    const readFileAsText = async (file: File) => file as unknown as string

    const { successful } = await evernoteConverter.convert(checkboxEnex as unknown as File, {
      insertNote: async ({ text }) => ({ content: { text } }) as never,
      insertTag: async () => ({ content: { references: [] } }) as never,
      convertHTMLToSuper: (html, options) =>
        superConverter.convertOtherFormatToSuperString(html, 'html', { html: options }),
      convertMarkdownToSuper: jest.fn(),
      readFileAsText,
      canUseSuper: true,
      canUploadFiles: false,
      uploadFile: async () => void 0,
      linkItems: async () => void 0,
      cleanupItems: async () => void 0,
    })

    const superString = (successful?.[0] as unknown as { content: { text: string } }).content.text
    expect(superString).toContain('"listType":"check"')
  })

  it('exports imported Evernote highlights as mark elements', async () => {
    const crypto = {
      generateUUID: () => String(Math.random()),
    } as unknown as PureCryptoInterface
    const generateUuid = new GenerateUuid(crypto)
    const superConverter = new HeadlessSuperConverter()
    const evernoteConverter = new EvernoteConverter(generateUuid)

    const readFileAsText = async (file: File) => file as unknown as string

    const { successful } = await evernoteConverter.convert(highlightEnex as unknown as File, {
      insertNote: async ({ text }) => ({ content: { text } }) as never,
      insertTag: async () => ({ content: { references: [] } }) as never,
      convertHTMLToSuper: (html, options) =>
        superConverter.convertOtherFormatToSuperString(html, 'html', { html: options }),
      convertMarkdownToSuper: jest.fn(),
      readFileAsText,
      canUseSuper: true,
      canUploadFiles: false,
      uploadFile: async () => void 0,
      linkItems: async () => void 0,
      cleanupItems: async () => void 0,
    })

    const superString = (successful?.[0] as unknown as { content: { text: string } }).content.text
    expect(superString).toContain('"format":128')
    expect(superString).toContain('background-color')
  })

  it('keeps a pipe inside a markdown table cell through export and import', async () => {
    const converter = new HeadlessSuperConverter()
    const markdown = '| a | yes\\|no | c |\n| 1 | 2 | 3 |'

    const superString = converter.convertOtherFormatToSuperString(markdown, 'md')
    const cellTexts = (JSON.stringify(JSON.parse(superString)).match(/"text":"[^"]*"/g) ?? []).map((t) =>
      t.slice(8, -1).trim(),
    )
    expect(cellTexts).toEqual(['a', 'yes|no', 'c', '1', '2', '3'])

    const exported = await converter.convertSuperStringToOtherFormat(superString, 'md')
    expect(exported).toMatch(/\|\s*a\s*\|\s*yes\\\|no\s*\|\s*c\s*\|/)
  })

  it('imports audio with a type from HTML as audio, with its file name', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString(
      '<audio controls data-file-name="talk.m4a"><source src="data:audio/mp4;base64,AAAA" type="audio/mp4"></audio>',
      'html',
      { html: { addLineBreaks: false } },
    )

    expect(superString).toContain('"mimeType":"audio/mp4"')
    expect(superString).toContain('"fileName":"talk.m4a"')
  })

  it('imports a web image from HTML as a remote image, and an embedded one as an inline file', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString(
      '<p><img src="https://example.com/photo.jpg" alt="photo"></p><p><img src="data:image/png;base64,AAAA"></p>',
      'html',
      { html: { addLineBreaks: false } },
    )

    expect(superString).toContain('"src":"https://example.com/photo.jpg"')
    expect(superString).toContain('"type":"unencrypted-image"')
    expect(superString).toContain('"type":"inline-file"')
  })

  it('imports one line of HTML with a link and a line break as one paragraph', () => {
    const converter = new HeadlessSuperConverter()
    const superString = converter.convertOtherFormatToSuperString(
      'Hello <a href="https://example.com">link</a> world<br>next line',
      'html',
      { html: { addLineBreaks: false } },
    )

    const paragraphs = JSON.parse(superString).root.children.filter(
      (node: { type: string; children: unknown[] }) => node.type === 'paragraph' && node.children.length > 0,
    )
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].children.map((child: { type: string }) => child.type)).toEqual([
      'text',
      'link',
      'text',
      'linebreak',
      'text',
    ])
  })
})
