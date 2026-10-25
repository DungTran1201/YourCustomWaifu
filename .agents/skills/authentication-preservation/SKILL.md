---
name: authentication-preservation
description: Preserve current authentication and account features. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Authentication preservation

Use for authentication UI, account settings, token/session storage, API client changes, persistence, or desktop login windows.

## Steps
1. Trace existing register/login/logout API calls and backend authorization rules.
2. Understand session transport and expiry before changing storage or adding auto-login.
3. Keep UI validation aligned with backend validation; backend remains authoritative.
4. Use safe error messages that do not reveal whether sensitive account data exists unless product policy allows it.
5. Do not add email verification unless explicitly requested; do not invent password recovery if unsupported.
6. Ensure logout clears appropriate client state and does not unexpectedly close an independent Stage unless required by a documented security policy.
7. Confirm app restart/session restoration behavior and avoid logging credentials.

## Tests
Valid and invalid login, registration validation, API offline, expired/invalid session, logout, account update, and Stage behavior after Workspace close/logout.
