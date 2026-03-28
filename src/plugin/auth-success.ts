/**
 * Success page for authentication
 */

import { escapeHtml, buildHtmlHead, buildAutoCloseScript, COMMON_STYLES } from './html-utils.js'

/**
 * Builds the success page HTML
 *
 * @param email - User email (optional)
 * @returns Complete HTML page
 */
export function buildSuccessHtml(email?: string): string {
  const customStyles = `
    body {
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
    }
    .checkmark {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      position: relative;
    }
    .checkmark-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #48bb78;
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
    .checkmark-check {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 50px;
      border: solid white;
      border-width: 0 6px 6px 0;
      transform: translate(-50%, -60%) rotate(45deg);
      animation: checkmark 0.5s 0.3s ease-out forwards;
      opacity: 0;
    }
    @keyframes checkmark {
      to {
        opacity: 1;
        transform: translate(-50%, -60%) rotate(45deg) scale(1);
      }
    }
  `

  const message = email
    ? `You have been successfully authenticated as <strong>${escapeHtml(email)}</strong>. You can now close this window and return to your terminal.`
    : 'You have been successfully authenticated. You can now close this window and return to your terminal.'

  return `
${buildHtmlHead('Authentication Successful', customStyles)}
<body>
  <div class="container">
    <div class="checkmark">
      <div class="checkmark-circle"></div>
      <div class="checkmark-check"></div>
    </div>
    <h1>Authentication Successful!</h1>
    <p class="subtitle">${message}</p>
    <div class="auto-close">This window will close automatically in <span id="countdown">3</span> seconds</div>
  </div>

  ${buildAutoCloseScript(3)}
</body>
</html>`
}
