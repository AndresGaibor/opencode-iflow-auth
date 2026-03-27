import { isHeadlessEnvironment } from "../headless.js"

export const openBrowser = (url: string) => {
  if (isHeadlessEnvironment()) {
    return
  }
  const platform = process.platform
  if (platform === "win32") {
    import("node:child_process").then(({ exec }) => {
      exec(`cmd /c start "" "${url}"`)
    })
  } else if (platform === "darwin") {
    import("node:child_process").then(({ exec }) => {
      exec(`open "${url}"`)
    })
  } else {
    import("node:child_process").then(({ exec }) => {
      exec(`xdg-open "${url}"`)
    })
  }
}
