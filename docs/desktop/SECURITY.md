# Electron Desktop Security Baseline

## 1. Compliance Checklist
YourCustomWaifu implements the official [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security/):

| Security Control | Implementation | Verification |
|---|---|---|
| **Context Isolation** | `contextIsolation: true` in all window webPreferences | Unit test in `security.spec.ts` |
| **Node Integration Disabled** | `nodeIntegration: false` in all windows | Unit test in `security.spec.ts` |
| **Process Sandboxing** | `sandbox: true` in all windows | Main process configuration |
| **Strict Content Security Policy** | Enforced via `onHeadersReceived` filter | Unit test verifying absence of `unsafe-eval` |
| **Typed IPC & Sender Validation** | `validateIpcSender()` checks webContents ID against known windows | Unit tests in `security.spec.ts` and `stage-lifecycle.spec.ts` |
| **Safe External Navigation** | `setWindowOpenHandler` blocks new windows and delegates URLs to `shell.openExternal` | Configured in `enforceWindowSecurity()` |
| **Credential Protection** | `safeStorage` OS-level encryption for refresh tokens | Configured in `AUTH_LOGIN` and `AUTH_GET_STORED_SESSION` |
| **Local File Access** | Local VRM files loaded via native file dialog and streamed via array buffer | No raw file path disclosure to untrusted web contexts |

## 2. Content Security Policy (CSP)
The Content Security Policy prevents remote code execution and unauthorized data exfiltration:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com;
font-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

## 3. IPC Sender Verification
All IPC handles verify the sender identity before executing:

```ts
export function validateIpcSender(
  sender: WebContents,
  allowedWindows: BrowserWindow | (BrowserWindow | null)[] | null
): boolean {
  if (!sender || sender.isDestroyed()) return false;
  const windows = Array.isArray(allowedWindows) ? allowedWindows : [allowedWindows];
  return windows.some(win => win && !win.isDestroyed() && win.webContents.id === sender.id);
}
```

## 4. Credential & Secret Masking Invariant
- **Model API Keys**: Never displayed in plaintext once saved. Stored with masked hints (e.g. `...abcd`) in memory and encrypted at rest.
- **Session Tokens**: Stored in `session.enc` in the user data folder using Electron `safeStorage` (which leverages DPAPI on Windows and Keychain on macOS).
