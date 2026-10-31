# F02 — Provider Connections and API Keys

## 1. Functional Scope & Purpose
F02 manages third-party AI provider credentials (Google Gemini, OpenAI, Anthropic Claude). Users provide their own API keys, which are envelope-encrypted at rest and used only in privileged background runtime to communicate with remote LLM providers.

## 2. Current Implementation & Confirmed Defect Status
- **Envelope Encryption:** AES-256-GCM in `crypto.ts:84`.
- **Defect P0 (Remediated):** Formerly used a static fallback dev seed in `getMasterKey()`. Remediated to use Electron `safeStorage` (OS DPAPI/Keychain) to protect a dynamically generated 256-bit random master key in `userData/kms-master.enc`. Legacy decryption supported for non-destructive credential migration.
- **Defect P1 (Remediated):** Formerly passed the Gemini API key in `?key=` query parameters. Remediated to use standard `x-goog-api-key` HTTP header, preventing secret leakage in URLs and logs.
- **Provider Routers:** `GeminiAdapter`, `OpenAIAdapter`, and `AnthropicAdapter` in `provider-adapters.ts`.
- **UI Exposure:** Only masked key hints (e.g. `...1234`) are exposed to the Vue renderer in `user_secrets_vault`. Full keys never enter renderer memory.

## 3. Requirements & Acceptance Criteria
- AC-01: API keys must be encrypted with AES-256-GCM using an OS-backed master key.
- AC-02: If secure storage is unavailable and no master key is supplied via environment variable, the system must fail safely with a distinct error.
- AC-03: Provider API requests must transmit credentials strictly via HTTP headers (`x-goog-api-key`, `Authorization: Bearer`, `x-api-key`), never in query strings or request URLs.
- AC-04: Test connection endpoint (`/api/v1/providers/test`) must verify the key against the provider's model list and update connection status.
- AC-05: Key deletion must securely remove the encrypted secret from the database.

## 4. Verification & Test Traceability
- Unit tests: `apps/desktop/tests/provider-chat-runtime.spec.ts` (12 tests).
- Security tests: `apps/desktop/tests/crypto-security.spec.ts` (newly added test suite verifying safeStorage integration, tag verification, and URL query parameter exclusion).
