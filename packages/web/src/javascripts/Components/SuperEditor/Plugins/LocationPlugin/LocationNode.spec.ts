/**
 * @jest-environment jsdom
 */

import { HeadlessSuperConverter } from '../../Tools/HeadlessSuperConverter'

const paragraph = (text: string) => ({
  children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
})

const noteWith = (location: Record<string, unknown>) =>
  JSON.stringify({
    root: {
      children: [paragraph('Before'), { format: '', type: 'location', version: 1, ...location }, paragraph('After')],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })

describe('LocationNode', () => {
  const named = noteWith({ lat: 47.3769, lng: 8.5417, name: 'Home' })
  const unnamed = noteWith({ lat: -33.8688, lng: 151.2093 })
  const link = 'https://www.openstreetmap.org/?mlat=47.376900&mlon=8.541700#map=17/47.376900/8.541700'

  it('is a valid part of a Super note and keeps its data', async () => {
    const converter = new HeadlessSuperConverter()
    expect(converter.isValidSuperString(named)).toBe(true)

    const json = JSON.parse(await converter.convertSuperStringToOtherFormat(named, 'json'))
    expect(json.root.children[1]).toMatchObject({ type: 'location', lat: 47.3769, lng: 8.5417, name: 'Home' })
  })

  it('exports to Markdown as a link with name, coordinates and plus code', async () => {
    const markdown = await new HeadlessSuperConverter().convertSuperStringToOtherFormat(named, 'md')
    expect(markdown).toContain(`[📍 Home (47.37690, 8.54170, 8FVC9GGR+QM)](${link})`)
    expect(markdown).toContain('Before')
    expect(markdown).toContain('After')
  })

  it('exports to plain text', async () => {
    const converter = new HeadlessSuperConverter()
    expect(await converter.convertSuperStringToOtherFormat(named, 'txt')).toContain(
      'Home (47.37690, 8.54170, 8FVC9GGR+QM)',
    )
    expect(await converter.convertSuperStringToOtherFormat(unnamed, 'txt')).toContain(
      '-33.86880, 151.20930, 4RRH46J5+FP',
    )
  })

  it('exports to HTML as a link', async () => {
    const html = await new HeadlessSuperConverter().convertSuperStringToOtherFormat(named, 'html')
    expect(html).toContain('📍 Home (47.37690, 8.54170, 8FVC9GGR+QM)')
    expect(html).toContain('mlat=47.376900')
  })
})
