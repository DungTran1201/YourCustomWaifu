# Known Issues, Root Cause Analysis & Remediation Plan

This document records confirmed technical defects, security risks, and architectural gaps in YourCustomWaifu along with empirical evidence, root cause analysis, and remediation strategies.

---

## 1. Confirmed Defects

### Defect P0-1: Static Development Fallback Key in Master Key Derivation
- **Severity:** P0 (Critical Security Vulnerability)
- **Location:** `apps/desktop/electron/server/crypto.ts:74-79` and duplicate `apps/desktop/server/crypto.ts:74-79`
- **Symptom / Evidence:**
  ```typescript
  function getMasterKey(): Buffer {
    const rawKey =
      process.env.KMS_MASTER_KEY ||
      "default-vrm-kms-master-key-dev-seed-32bytes!";
    return crypto.createHash("sha256").update(rawKey).digest();
  }
  ```
- **Root Cause:**
  When `KMS_MASTER_KEY` environment variable is not explicitly supplied (which is true in standard end-user desktop installations), the encryption service silently falls back to a publicly known static string. Anyone with access to the local SQLite database file can decrypt all third-party API keys (Gemini, OpenAI, Anthropic).
- **Risk:**
  Complete exposure of user API credentials if the database file is accessed or exported.
- **Remediation Plan:**
  1. Remove the static string fallback.
  2. Implement an OS-backed secure storage key lifecycle using Electron's `safeStorage` (DPAPI on Windows, Keychain on macOS, Libsecret on Linux).
  3. Generate a cryptographically strong 256-bit random master key per installation, encrypt it with `safeStorage.encryptString()`, and store it in `userData/kms-master.enc`.
  4. If `safeStorage` is unavailable (e.g. headless environment) and `KMS_MASTER_KEY` is not provided, fail safely with `SecureStorageUnavailableError` rather than proceeding insecurely.
  5. Provide a transparent legacy decryption fallback that can decrypt secrets previously encrypted with the dev seed and schedule them for re-encryption under the secure key.

---

### Defect P1-1: Gemini API Key Transmitted in URL Query Parameter
- **Severity:** P1 (High Security Risk)
- **Location:** `apps/desktop/electron/server/provider-adapters.ts:60, 119`
- **Symptom / Evidence:**
  ```typescript
  const url = `${this.baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
  const url = `${this.baseUrl}/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
  ```
- **Root Cause:**
  The Gemini adapter passed the credential in the URL query string rather than in an authorization HTTP header.
- **Risk:**
  URL query parameters are logged in HTTP client telemetry, proxy logs, web server access logs, and referrer headers, leading to secret exposure.
- **Remediation Plan:**
  Update `GeminiAdapter` to pass the key via the official `x-goog-api-key` header:
  ```typescript
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey.trim(),
  }
  ```
  And strip `?key=` from all request URLs.

---

### Defect P1-2: IPC Channel Omission for Blink Diagnostics
- **Severity:** P1 (Contract / IPC Inconsistency)
- **Location:** `packages/platform-contracts/src/index.ts`, `apps/desktop/electron/preload/index.ts`, `apps/desktop/electron/main/index.ts`
- **Symptom / Evidence:**
  `IPC_CHANNELS.STAGE_GET_BLINK_DIAGNOSTIC` is declared in contracts and `DesktopStageAPI.getBlinkDiagnostic` is typed, but neither `preload/index.ts` nor `main/index.ts` registered the IPC invoke handler.
- **Root Cause:**
  Feature omission during initial multi-window diagnostic wiring.
- **Remediation Plan:**
  Implement `ipcMain.handle(IPC_CHANNELS.STAGE_GET_BLINK_DIAGNOSTIC)` in `main/index.ts` and expose it via `preload/index.ts` and web fallback.

---

### Defect P1-3: Store State Mutation Optimistic Updates Suppressing Persistence Errors
- **Severity:** P1 (Data Consistency & UX Defect)
- **Location:** `apps/desktop/src/stores/store.ts` (`addSkill`, `updateSkill`, `deleteSkill`, `addRule`, `updateRule`, `deleteRule`, `updateAgent`, `toggleTool`, `updateTool`, `addMemory`, `deleteMemory`)
- **Symptom / Evidence:**
  Local reactive state was updated optimistically, and subsequent `apiRequest` errors were caught and discarded with `catch { /* fallback */ }`.
- **Root Cause:**
  Lack of rollback mechanisms or error propagation on failed API requests.
- **Risk:**
  The user interface displays an item as saved or deleted even when the backend rejected the operation or network failed. On app restart or page refresh, changes vanish unexpectedly.
- **Remediation Plan:**
  Implement snapshot capture before mutation. If the server request fails, restore the snapshot, set `state.errorMessage`, and rethrow or return failure so UI components can display actionable feedback.

---

### Defect P1-4: Provider Request Stalling / Missing Timeout & Cancellation
- **Severity:** P1 (Availability / Resilience)
- **Location:** `apps/desktop/electron/server/server.ts:778-815`
- **Symptom / Evidence:**
  `generateChatResponse` was invoked without passing `req.signal` or setting an HTTP deadline.
- **Root Cause:**
  Missing timeout orchestration between backend server and provider adapters.
- **Risk:**
  If a model provider's API hangs, client requests hang indefinitely, keeping the UI in `chatSending = true` forever.
- **Remediation Plan:**
  Implement a 30-second default request timeout via `AbortController`, link client disconnects (`req.on("close")`), and normalize error codes (504 timeout, 429 rate limit, 401 auth failure).

---

### Defect P1-5: Disconnected Model Tool Calling Loop
- **Severity:** P1 (Functional Completeness)
- **Location:** `apps/desktop/electron/server/server.ts:720-765`
- **Symptom / Evidence:**
  Tool descriptions were injected into the system prompt, but if the model responded with a tool invocation, no loop existed to parse, execute, and feed results back to the model.
- **Root Cause:**
  Incomplete chat runtime orchestration.
- **Remediation Plan:**
  Add structured tool call detection (via JSON block parsing), dispatch through `ToolExecutor`, enforce security / confirmation constraints, and execute a bounded follow-up turn.
