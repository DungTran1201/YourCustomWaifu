# Authentication & Account Integration

## 1. Overview
YourCustomWaifu preserves the existing SQLite relational database and auth service in `backend/src/`. The service operates identically across both the Web client and the Electron Desktop app.

## 2. API Endpoints

| Endpoint | Method | Purpose | Client Context |
|---|---|---|---|
| `/api/v1/auth/register` | `POST` | Instant user registration (zero email verification delay) | Web & Desktop |
| `/api/v1/auth/login` | `POST` | Web cookie/session login | Web SPA |
| `/api/v1/auth/desktop-login` | `POST` | Issues long-lived refresh token for desktop storage | Electron Main |
| `/api/v1/auth/desktop-refresh` | `POST` | Exchanges valid refresh token for a fresh session | Electron Main |
| `/api/v1/auth/logout` | `POST` | Revokes active session in SQLite | Web & Desktop |
| `/api/v1/users/me` | `GET` | Retrieves profile and account metadata | Web & Desktop |

## 3. Desktop Session Architecture
1. **Login Flow**:
   - The user inputs credentials in the Workspace SignIn view.
   - The preload invokes `desktopAPI.auth.login(credentials)`.
   - The Electron Main process calls `/api/v1/auth/desktop-login` directly from Node.js (bypassing CORS restrictions).
   - The received refresh token is encrypted via `safeStorage.encryptString(token)` and saved to `%APPDATA%/YourCustomWaifu/session.enc`.
2. **Startup Auto-Login Flow**:
   - On application launch, Workspace calls `desktopAPI.auth.getStoredSession()`.
   - Main reads `session.enc`, decrypts via `safeStorage.decryptString()`, and calls `/api/v1/auth/desktop-refresh`.
   - If valid, the user profile is returned and the Workspace immediately enters authenticated state without prompting.
3. **Logout Flow**:
   - The user clicks Logout.
   - The Electron Main process deletes `session.enc` and revokes the active session on the backend.

## 4. Password Policy & Security Rules
- Minimum password length: 15 characters (consistent with server enforcement and tests).
- Password hashing: `scrypt` with salt and memory-hard parameters.
- Rate limiting: sliding window per IP subnet preventing credential-stuffing attacks.
