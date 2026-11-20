import { sanitizeUrl } from './sanitizeUrl'

describe('sanitizeUrl', () => {
  it.each([
    ['google.com', 'https://google.com'],
    ['www.example.com/path?q=1', 'https://www.example.com/path?q=1'],
    ['https://example.com', 'https://example.com'],
    ['mailto:bob@example.com', 'mailto:bob@example.com'],
    ['obsidian://open?vault=x', 'obsidian://open?vault=x'],
    ['zoommtg://zoom.us/join?confno=1', 'zoommtg://zoom.us/join?confno=1'],
    ['localhost:3000/notes', 'https://localhost:3000/notes'],
    ['javascript:alert(1)', 'https://'],
    [' JavaScript:alert(1)', 'https://'],
    ['vbscript:msgbox', 'https://'],
    ['data:text/html,<script>', 'https://'],
    ['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
    ['#heading', '#heading'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeUrl(input)).toBe(expected)
  })
})
