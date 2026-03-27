# OpenCode iFlow Auth Plugin - Gemini Context

This project is an OpenCode plugin for `iFlow.cn` providing authentication and proxy support for various AI models, including Qwen, DeepSeek, Kimi, GLM, and iFlow ROME.

## Project Overview

- **Purpose**: Provides dual authentication (OAuth 2.0 and API Key) and CLI Proxy support for iFlow models.
- **Key Technologies**: TypeScript, Node.js (ESM), OpenCode Plugin SDK, `proper-lockfile`, `tiktoken`, `zod`.
- **Architecture**:
  - **Main Entry**: `src/index.ts` exports `IFlowPlugin` and `IFlowProxyPlugin`.
  - **Proxy Server**: `src/iflow/proxy.ts` implements `IFlowCLIProxy`, a local HTTP server (port 19998) that routes requests to either the iFlow API or the `iflow` CLI (for models like `glm-5`).
  - **Account Management**: `src/plugin/accounts.ts` manages multiple credentials, health status, and rotation strategies (`sticky`, `round-robin`).
  - **Model Discovery**: `src/iflow/models.ts` handles dynamic model listing and configuration inference.
  - **Authentication**: `src/iflow/oauth.ts` and `src/iflow/apikey.ts` handle the respective auth flows.

## Building and Running

- **Install Dependencies**: `npm install`
- **Build**: `npm run build` (uses `tsconfig.build.json`)
- **Format Code**: `npm run format` (uses Prettier)
- **Type Check**: `npm run typecheck`
- **Publish**: `publish.js` script is used for automated publishing.

## Development Conventions

- **Module System**: The project uses ESM (`"type": "module"` in `package.json`).
- **Styling**: Prettier is used for formatting with specific CLI flags (see `package.json`).
- **Storage**:
  - Credentials: `~/.config/opencode/iflow-accounts.json`
  - Plugin Config: `~/.config/opencode/iflow.json`
- **Environment Variables**:
  - `IFLOW_AUTH_DEBUG`: Enable debug logging for auth.
  - `IFLOW_PROXY_DEBUG`: Enable debug logging for the proxy.
  - `IFLOW_AUTO_INSTALL_CLI`: Auto-install `iflow-cli`.
- **Error Handling**: Custom error types defined in `src/plugin/errors.ts`.

## Key Files

- `src/index.ts`: Plugin initialization and OpenCode hooks.
- `src/constants.ts`: Constants, model configurations, and thinking model patterns.
- `src/iflow/proxy.ts`: The smart routing proxy implementation.
- `src/plugin/accounts.ts`: Multi-account management logic.
- `package.json`: Dependencies and build scripts.
