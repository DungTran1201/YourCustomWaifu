# F01 — Account and Security

## 1. Functional Scope & Purpose
F01 provides user registration, local authentication, session lifecycle, brute-force rate limiting, password reset flows, and session isolation. In the desktop architecture, authentication guards access to the personal companion, private memory vaults, and provider API keys.

## 2. Current Implementation
- **Password Hashing:** `apps/desktop/electron/server/crypto.ts:13` using `scryptSync` with unique 16-byte random salt, $N=16384, r=8, p=1$, 64MB memory hard.
- **Session Tokens:** Cryptographically secure 32-byte hex tokens, indexed in SQLite via SHA-256 hash (`hashToken`).
- **Brute Force Protection:** Sliding-window rate limiter in `rate-limiter.ts` restricting failed attempts per IP subnet and email. Account lockouts triggered on excessive failed authentications.
- **IPC & Session Restoration:** `AUTH_LOGIN`, `AUTH_REGISTER`, and `AUTH_GET_STORED_SESSION` handlers in `main/index.ts`. Stored session refresh tokens are persisted in `userData/session.enc` protected via Electron `safeStorage`.

## 3. Requirements & Acceptance Criteria
- AC-01: Passwords must be validated (min 15 characters, max 128) and hashed using memory-hard scrypt.
- AC-02: Plaintext passwords must never be logged or stored.
- AC-03: Stored desktop sessions must be encrypted using OS-backed `safeStorage` (DPAPI/Keychain).
- AC-04: Session tokens sent in HTTP requests must be accompanied by anti-CSRF tokens.
- AC-05: Account deletion must cascade and completely purge user profiles, memories, chat messages, skills, rules, and encrypted secrets.

## 4. Security & Privacy Boundaries
- Trust boundary: Renderer process has no direct database access; requests pass through typed IPC or local HTTP loopback with token validation.
- Multi-user isolation: All companion data queries filter strictly by `user_id = ?`.

## 5. Verification & Test Traceability
- Unit tests: `apps/desktop/tests/auth.spec.ts` (19 passing tests covering password hashing, lockout, session revocation).
- Component tests: `apps/desktop/tests/auth-ui.spec.ts` (6 passing tests).
- E2E tests: `apps/desktop/tests/companion-e2e-flow.spec.ts` (full registration -> chat -> account deletion cascade).
