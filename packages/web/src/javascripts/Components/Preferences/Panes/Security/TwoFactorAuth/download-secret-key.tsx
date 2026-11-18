export function downloadSecretKey(text: string) {
  const link = document.createElement('a')
  const blob = new Blob([text], {
    type: 'text/plain;charset=utf-8',
  })
  link.href = window.URL.createObjectURL(blob)
  link.setAttribute('download', 'standardnotes_2fa_key.txt')
  document.body.appendChild(link)
  link.click()
  link.remove()
  /** Revoking right after click() can cancel the download in Safari and Firefox. */
  setTimeout(() => window.URL.revokeObjectURL(link.href), 1000)
}
