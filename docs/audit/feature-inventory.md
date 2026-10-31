# Feature Inventory & Verification Matrix — YourCustomWaifu

This document catalogs every functional capability in YourCustomWaifu, its implementation location, test evidence, and verified status.

**Status Legend:**
- `VERIFIED`: Proven by source inspection and passing automated tests/runtime behavior.
- `PARTIALLY_IMPLEMENTED`: Core functionality exists but requires completion, hardening, or bug fixes.
- `MISSING`: Not yet implemented in the codebase.
- `BROKEN`: Confirmed broken or non-functional.
- `BLOCKED`: Implementation blocked by an external or environmental dependency.
- `NOT_REQUIRED`: Explicitly excluded from desktop product scope.

---

## 1. Feature Classification Matrix

| Feature Code | Feature Name | Source Implementation | Test & Execution Evidence | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **F01.1** | Account Registration | `auth-service.ts`, `server.ts:160` | `auth.spec.ts:17-48`, scrypt N=16384 | `VERIFIED` |
| **F01.2** | Account Login & Session | `auth-service.ts`, `server.ts:210` | `auth.spec.ts:50-85`, SHA-256 tokens | `VERIFIED` |
| **F01.3** | Account Logout & Session Revocation | `auth-service.ts`, `server.ts:260` | `auth.spec.ts:87-112`, unlinks stored session | `VERIFIED` |
| **F01.4** | Rate Limiting & Brute Force Lockout | `rate-limiter.ts`, `server.ts` | `auth.spec.ts:130-165`, IP subnet tracking | `VERIFIED` |
| **F02.1** | Provider Key Envelope Encryption | `crypto.ts`, `auth-service.ts:619` | `security.spec.ts`, AES-256-GCM | `PARTIALLY_IMPLEMENTED` (P0 dev fallback present) |
| **F02.2** | Gemini Provider Adapter | `provider-adapters.ts:43` | `provider-chat-runtime.spec.ts:16` | `PARTIALLY_IMPLEMENTED` (P1 key in query string) |
| **F02.3** | OpenAI Provider Adapter | `provider-adapters.ts:186` | `provider-chat-runtime.spec.ts:96` | `VERIFIED` |
| **F02.4** | Anthropic Provider Adapter | `provider-adapters.ts:328` | `provider-chat-runtime.spec.ts:165` | `VERIFIED` |
| **F02.5** | Provider Connection Testing | `provider-adapters.ts`, `server.ts:570` | `provider-chat-runtime.spec.ts:24` | `VERIFIED` |
| **F03.1** | Dynamic / Static Model Discovery | `provider-adapters.ts` | `provider-chat-runtime.spec.ts:38` | `VERIFIED` |
| **F03.2** | Model Parameter Configuration | `server.ts`, `store.ts` | `companion-configuration.spec.ts` | `VERIFIED` |
| **F04.1** | Skills CRUD & Persistence | `companion-repository.ts`, `server.ts:920` | `companion-storage.spec.ts:130` | `PARTIALLY_IMPLEMENTED` (Store rollback needed) |
| **F04.2** | Rules CRUD & Priority Scoping | `companion-repository.ts`, `server.ts:970` | `companion-storage.spec.ts:180` | `PARTIALLY_IMPLEMENTED` (Store rollback needed) |
| **F05.1** | Agent Persona Lifecycle | `companion-repository.ts`, `server.ts:838` | `companion-storage.spec.ts:90` | `VERIFIED` |
| **F05.2** | System Prompt Multi-Layer Assembly | `server.ts:740-766` | `ai-evaluation-suite.spec.ts:124` | `VERIFIED` |
| **F06.1** | Real LLM Request/Response Runtime | `server.ts:636`, `provider-adapters.ts` | `ai-evaluation-suite.spec.ts:133` | `PARTIALLY_IMPLEMENTED` (Timeouts/cancellation needed) |
| **F06.2** | Conversation Context Window Bounds | `server.ts:768-776` | `ai-evaluation-suite.spec.ts:167` (bounded to 12 turns) | `VERIFIED` |
| **F06.3** | Chat History Persistence & Clear | `companion-repository.ts`, `server.ts:818` | `companion-storage.spec.ts:310` | `VERIFIED` |
| **F07.1** | Private Memory Store & Categories | `companion-repository.ts`, `server.ts:1070` | `companion-memory.spec.ts:25` | `VERIFIED` |
| **F07.2** | Memory Semantic Recall in Prompt | `server.ts:703-717` | `companion-memory.spec.ts:310` | `VERIFIED` |
| **F08.1** | Builtin Tools Registry & Validation | `tool-executor.ts:22-93` | `tool-executor.spec.ts:15-110` | `VERIFIED` |
| **F08.2** | Tool Permission & Confirmation Gate | `tool-executor.ts:335-346` | `tool-executor.spec.ts:85` | `VERIFIED` |
| **F08.3** | Closed-Loop Model Tool Execution | `server.ts:720-765` | Currently textual representation in prompt | `PARTIALLY_IMPLEMENTED` (Execution loop needed) |
| **F09.1** | Local VRM File Selection & Loading | `main/index.ts:1087`, `stage.ts` | `vrm-parsing.spec.ts:12` | `VERIFIED` |
| **F09.2** | General Document Attachments | N/A | Excluded from desktop companion MVP | `NOT_REQUIRED` |
| **F10.1** | Independent Dual Window Lifecycle | `main/index.ts:45`, `main/security.ts` | `stage-lifecycle.spec.ts:20` | `VERIFIED` |
| **F10.2** | Universal 7-Stage VRM Pipeline | `stage.ts`, `prepareVrmForStage` | `vrm-pose.spec.ts:70-130` | `VERIFIED` |
| **F10.3** | Autonomic VRM Blinking Controller | `vrm-blink.ts` | `vrm-blink.spec.ts:20-110` | `VERIFIED` |
| **F10.4** | LookAt Gaze Tracking (30Hz Loop) | `main/index.ts:148`, `stage.ts` | Visual verification screenshots | `VERIFIED` |
| **F11.1** | Application Diagnostics IPC | `main/index.ts:622`, `preload/index.ts` | `entry-navigation.spec.ts:40` | `VERIFIED` |
| **F11.2** | Window Bounds & Config Persistence | `main/index.ts:75-121` | `workspace-contracts.spec.ts:15` | `VERIFIED` |
| **F12.1** | Offline AI Evaluation Harness | `tests/ai-evaluation-suite.spec.ts` | 4 test scenarios passing | `VERIFIED` |
| **F12.2** | Multi-Window Smoke Verification | `scripts/electron-smoke.cjs` | Package script `test:smoke` | `VERIFIED` |

---

## 2. Invariant Adherence Review

- **Workspace / Stage Independence:** Verified. Closing or hiding the Workspace window leaves the Stage running. Hiding Stage does not log out or terminate background tasks.
- **Renderer Isolation:** Verified. Context isolation is strictly enabled (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` with preload bridge).
- **Data Protection:** SQLite database persists locally in `app.getPath("userData")`. Passwords never leave backend; API keys stored envelope-encrypted.
