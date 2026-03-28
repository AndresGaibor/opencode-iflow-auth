/**
 * Device code authentication page
 */

import { escapeHtml, buildHtmlHead, COMMON_STYLES } from './html-utils.js'

/**
 * Builds the device code auth page HTML
 *
 * @param verificationUrl - URL for verification
 * @param userCode - User code to display
 * @param statusUrl - URL for status polling
 * @returns Complete HTML page
 */
export function buildDeviceAuthHtml(
  verificationUrl: string,
  userCode: string,
  statusUrl: string
): string {
  const escapedUrl = escapeHtml(verificationUrl)
  const escapedCode = escapeHtml(userCode)
  const escapedStatusUrl = escapeHtml(statusUrl)

  const customStyles = `
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 500px;
    }
    .instructions {
      background: #edf2f7;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .instructions ol {
      margin-left: 20px;
      color: #4a5568;
      font-size: 14px;
      line-height: 1.8;
    }
    .instructions li {
      margin-bottom: 8px;
    }
    .code-container {
      background: #f7fafc;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      position: relative;
    }
    .code-label {
      color: #4a5568;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 32px;
      font-weight: 700;
      color: #2d3748;
      letter-spacing: 4px;
      user-select: all;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: background 0.2s;
    }
    .code:hover {
      background: #edf2f7;
    }
    .copy-hint {
      color: #a0aec0;
      font-size: 12px;
      margin-top: 8px;
    }
    .url-container {
      margin-bottom: 32px;
    }
    .url-label {
      color: #4a5568;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .url-link {
      display: inline-block;
      color: #4299e1;
      text-decoration: none;
      font-size: 16px;
      padding: 12px 24px;
      border: 2px solid #4299e1;
      border-radius: 8px;
      transition: all 0.2s;
      font-weight: 600;
    }
    .url-link:hover {
      background: #4299e1;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #718096;
      font-size: 14px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #e2e8f0;
      border-top-color: #4299e1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `

  return `
${buildHtmlHead('AWS Builder ID Authentication', customStyles)}
<body>
  <div class="container">
    <h1>AWS Builder ID Authentication</h1>
    <p class="subtitle">Complete the authentication in your browser</p>

    <div class="instructions">
      <ol>
        <li>A browser window will open automatically</li>
        <li>Enter the code shown below</li>
        <li>Complete the authentication process</li>
      </ol>
    </div>

    <div class="code-container">
      <div class="code-label">Your Code</div>
      <div class="code" onclick="copyCode()">${escapedCode}</div>
      <div class="copy-hint">Click to copy</div>
    </div>

    <div class="url-container">
      <div class="url-label">Verification URL</div>
      <a href="${escapedUrl}" target="_blank" class="url-link">Open Browser</a>
    </div>

    <div class="status">
      <div class="spinner"></div>
      <span>Waiting for authentication...</span>
    </div>
  </div>

  <script>
    const statusUrl = '${escapedStatusUrl}';
    const verificationUrl = '${escapedUrl}';

    function copyCode() {
      const code = '${escapedCode}';
      navigator.clipboard.writeText(code).then(() => {
        const codeEl = document.querySelector('.code');
        const originalBg = codeEl.style.background;
        codeEl.style.background = '#48bb78';
        codeEl.style.color = 'white';
        setTimeout(() => {
          codeEl.style.background = originalBg;
          codeEl.style.color = '#2d3748';
        }, 300);
      }).catch(() => {});
    }

    window.addEventListener('load', () => {
      setTimeout(() => {
        window.open(verificationUrl, '_blank');
      }, 500);
    });

    async function checkStatus() {
      try {
        const response = await fetch(statusUrl);
        const data = await response.json();

        if (data.status === 'success') {
          window.location.href = '/success';
        } else if (data.status === 'failed' || data.status === 'timeout') {
          window.location.href = '/error?message=' + encodeURIComponent(data.message || 'Authentication failed');
        }
      } catch {
      }
    }

    setInterval(checkStatus, 2000);
    checkStatus();
  </script>
</body>
</html>`
}
