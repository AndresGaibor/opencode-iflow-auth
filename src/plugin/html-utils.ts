/**
 * HTML utilities for auth pages
 */

/**
 * Escapes HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Common CSS styles for auth pages
 */
export const COMMON_STYLES = {
  reset: `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  `,
  body: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `,
  container: `
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 450px;
    width: 100%;
    padding: 48px 40px;
    text-align: center;
    animation: slideIn 0.4s ease-out;
  `,
  slideIn: `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  h1: `
    color: #1a202c;
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 12px;
  `,
  subtitle: `
    color: #718096;
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 24px;
  `,
  autoClose: `
    color: #a0aec0;
    font-size: 14px;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
  `,
  responsive: `
    @media (max-width: 600px) {
      .container {
        padding: 32px 24px;
      }
      h1 {
        font-size: 24px;
      }
    }
  `,
}

/**
 * Builds the HTML head section with common styles
 *
 * @param title - Page title
 * @param customStyles - Additional custom styles
 * @returns Complete HTML head section
 */
export function buildHtmlHead(title: string, customStyles?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${COMMON_STYLES.reset}
    body { ${COMMON_STYLES.body} }
    .container { ${COMMON_STYLES.container} }
    ${COMMON_STYLES.slideIn}
    h1 { ${COMMON_STYLES.h1} }
    .subtitle { ${COMMON_STYLES.subtitle} }
    .auto-close { ${COMMON_STYLES.autoClose} }
    ${COMMON_STYLES.responsive}
    ${customStyles || ''}
  </style>
</head>`
}

/**
 * Builds the auto-close script for auth pages
 *
 * @param seconds - Seconds before closing
 * @returns Script tag
 */
export function buildAutoCloseScript(seconds: number = 3): string {
  return `
  <script>
    let seconds = ${seconds};
    const countdownEl = document.getElementById('countdown');

    const interval = setInterval(() => {
      seconds--;
      if (countdownEl) {
        countdownEl.textContent = seconds.toString();
      }

      if (seconds <= 0) {
        clearInterval(interval);
        try {
          window.close();
        } catch {
        }
      }
    }, 1000);
  </script>`
}
