/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** A pattern that matches safe data URLs. */
const DATA_URL_PATTERN =
  /^data:(?:image\/(?:bmp|gif|jpeg|jpg|png|tiff|webp)|video\/(?:mpeg|mp4|ogg|webm)|audio\/(?:mp3|oga|ogg|opus));base64,[a-z0-9+/]+=*$/i

/** A scheme ("obsidian:", "mailto:"), not a host with a port ("localhost:3000"). */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(?!\d)/i

const UNSAFE_SCHEMES = ['javascript', 'vbscript', 'data']

/**
 * Makes a link URL safe and usable:
 * - no scheme ("google.com") → https://google.com, so it opens the site and not a path inside the app
 * - any scheme is kept (obsidian://, zoommtg://, x-devonthink://…), except javascript:, vbscript: and data:
 *   (only images, video and audio data URLs are kept), which become "https://"
 */
export const sanitizeUrl = (url: string): string => {
  url = String(url).trim()

  if (url === '' || url.startsWith('#')) {
    return url
  }

  if (DATA_URL_PATTERN.test(url)) {
    return url
  }

  const scheme = url.match(SCHEME_PATTERN)?.[1]
  if (!scheme) {
    return `https://${url.replace(/^\/+/, '')}`
  }

  return UNSAFE_SCHEMES.includes(scheme.toLowerCase()) ? 'https://' : url
}
