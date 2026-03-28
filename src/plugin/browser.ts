/**
 * Browser utilities for opening URLs
 */

import { exec } from 'node:child_process'
import { platform } from 'node:os'

/**
 * Open a URL in the default browser
 * @param url - URL to open
 */
export function openBrowser(url: string): void {
  const plat = platform()

  if (plat === 'darwin') {
    exec(`open "${url}"`)
  } else if (plat === 'win32') {
    exec(`start "" "${url}"`)
  } else {
    exec(`xdg-open "${url}"`)
  }
}
