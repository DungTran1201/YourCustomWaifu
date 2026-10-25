# Rule: Authentication and user data preservation

- Inspect the existing auth flow and API contracts before altering account screens or services.
- Preserve existing registration, login, logout, session expiry and account management unless change is explicitly requested.
- Do not add email verification if the product currently intentionally omits it; do not invent password reset capabilities absent from backend support.
- Keep secret values out of renderer persistence and logs; never render a saved provider secret in full after it has been stored.
- Enforce authorization on the backend/service boundary, not only by hiding UI controls.
- Define how access tokens/session credentials are persisted and cleared based on the existing architecture; do not silently weaken current controls.
- Distinguish demo fixtures from live user data. Never show fabricated personal content as a real account response.
- Destructive account or memory actions need clear confirmation and accurate result states.
