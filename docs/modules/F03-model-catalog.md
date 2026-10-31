# F03 — Model Catalog and Parameters

## 1. Functional Scope & Purpose
F03 maintains the catalog of supported AI models per provider, verifies model availability, and enables per-agent and global model parameter configuration (temperature, maxTokens).

## 2. Current Implementation
- **Gemini Models:** `gemini-2.5-flash` (default), `gemini-2.5-pro`, `gemini-2.0-flash`.
- **OpenAI Models:** `gpt-4o` (default), `gpt-4o-mini`, `o1`, `o3`.
- **Anthropic Models:** `claude-3-5-sonnet-20241022` (default), `claude-3-5-haiku-20241022`.
- **Discovery Mechanism:** When `testConnection()` succeeds, available models are parsed from the remote provider's models endpoint and saved into `user_provider_settings`.
- **Parameter Validation:** Temperature is clamped between 0.0 and 2.0; maxTokens bounded to provider-supported limits.

## 3. Requirements & Acceptance Criteria
- AC-01: Default models must be provisioned automatically when configuring a new provider.
- AC-02: User model selection in Agent configuration must validate against supported provider models.
- AC-03: Provider error states during discovery must degrade gracefully to static curated models.
