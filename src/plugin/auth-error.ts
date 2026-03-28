/**
 * Error page for authentication
 */

import { escapeHtml, buildHtmlHead, buildAutoCloseScript, COMMON_STYLES } from './html-utils.js'

/**
 * Builds the error page HTML
 *
 * @param message - Error message to display
 * @returns Complete HTML page
 */
export function buildErrorHtml(message: string): string {
  const customStyles = `
    body {
      background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
    }
    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      position: relative;
    }
    .error-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #fc8181;
      animation: scaleIn 0.5s ease-out;
    }
    @keyframes scaleIn {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }
    .error-x {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
    }
    .error-x::before,
    .error-x::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 6px;
      background: white;
      border-radius: 3px;
      animation: xmark 0.5s 0.3s ease-out forwards;
      opacity: 0;
    }
    .error-x::before {
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .error-x::after {
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    @keyframes xmark {
      to {
        opacity: 1;
      }
    }
    .error-details {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      color: #c53030;
      font-size: 14px;
      word-break: break-word;
    }
    .instruction {
      color: #4a5568;
      font-size: 15px;
      margin-bottom: 24px;
    }
  `

  const escapedMessage = escapeHtml(message)

  return `
${buildHtmlHead('Authentication Failed', customStyles)}
<body>
  <div class="container">
    <div class="error-icon">
      <div class="error-circle"></div>
      <div class="error-x"></div>
    </div>
    <h1>Authentication Failed</h1>
    <p class="subtitle">We were unable to complete the authentication process.</p>
    <div class="error-details">${escapedMessage}</div>
    <p class="instruction">You can close this window and try again from your terminal.</p>
    <div class="auto-close">This window will close automatically in <span id="countdown">5</span> seconds</div>
  </div>

  ${buildAutoCloseScript(5)}
</body>
</html>`
}

/**
 * Builds the auth failed page HTML
 *
 * @param error - Authorization error
 * @returns Complete HTML page
 */
export function buildAuthFailedHtml(error: string): string {
  return buildErrorHtml(`Authorization failed: ${escapeHtml(error)}`)
}

/**
 * Builds the missing parameter page HTML
 *
 * @param param - Missing parameter name
 * @returns Complete HTML page
 */
export function buildMissingParamHtml(param: string): string {
  return buildErrorHtml(`Missing required parameter: ${escapeHtml(param)}`)
}

/**
 * Builds the state mismatch page HTML
 *
 * @returns Complete HTML page
 */
export function buildStateMismatchHtml(): string {
  return buildErrorHtml('State mismatch. Please try again.')
}
