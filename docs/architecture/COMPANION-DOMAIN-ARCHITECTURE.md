# YourCustomWaifu — Companion Domain Architecture & System Flows

**Document Status:** Canonical Architecture Document  
**Version:** 1.0.0 (Phase 0 Baseline & Target Blueprint)  
**Author:** Operation Dev (Engineering Lead & Delivery Owner)  
**Last Updated:** October 2026

---

## 1. Executive Summary & Audit Baseline

YourCustomWaifu is a desktop-first personal AI companion built with Electron, Vue 3, TypeScript, and Three.js/VRM. The application operates with two independent windows:
1. **Workspace Window:** Multi-tab companion management (Chat, Agents, Skills, Rules, Tools, Model Connections, Memory, Avatar Settings, Account, Security, Secrets, Diagnostics).
2. **Avatar Stage Window:** Transparent, frameless window rendering an interactive 3D VRM avatar with real-time gaze tracking and facial expressions.

### 1.1 As-Is Feature Classification & Audit Evidence

An evidence-based audit of the local repository checkout confirms the following status across all requested domains:

| Domain / Feature | Status | Implementation Evidence | Key Gaps & Observations |
| :--- | :--- | :--- | :--- |
| **Account & Authentication** | `PERSISTED & WORKING` | `apps/desktop/electron/server/auth-service.ts`, `database.ts`, `server.ts` | Complete scrypt hashing, sessions, password reset, account deletion, and profile management. No email verification gate by design. |
| **Hardware / Secret Vault** | `PERSISTED & WORKING` | `auth-service.ts` (`saveSecret`, `getSecrets`), `crypto.ts` (`encryptSecret`, `decryptSecret`) | AES-256-GCM envelope encryption storing ciphertext, nonce, tag, and safe key hint in `user_secrets_vault`. Only safe hints exposed to renderer. |
| **AI Model & Provider Config** | `PARTIAL / MOCK` | `store.ts` (`modelConnections`, `testConnection`) | `testConnection` simulates readiness using `setTimeout(r, 400)` without network or adapter calls. Provider selection is in-memory only. |
| **Agent & System Prompts** | `IN-MEMORY / MOCK` | `store.ts` (`state.agents`, `updateAgent`), `AgentsView.vue` | In-memory reactive array initialized with sample agent "Aiko". Changes do not persist to database; no DB tables exist. |
| **Skills Management** | `IN-MEMORY / MOCK` | `store.ts` (`state.skills`, `addSkill`, `updateSkill`, `deleteSkill`), `SkillsView.vue` | Reactive array with 3 sample items. Operations update memory only; no backend persistence or runtime consumption. |
| **Rules Management** | `IN-MEMORY / MOCK` | `store.ts` (`state.rules`, `addRule`, `updateRule`, `deleteRule`), `RulesView.vue` | Reactive array with 3 sample rules. Priority/scope not enforced by any runtime; no backend persistence. |
| **Tools & Permissions** | `IN-MEMORY / MOCK` | `store.ts` (`state.tools`, `toggleTool`, `updateTool`), `ToolsView.vue` | Mock catalog of 3 tools. No handler registry, argument schema validation, or execution permissions in trusted runtime. |
| **Memory & Privacy Vault** | `IN-MEMORY / MOCK` | `store.ts` (`state.memories`, `addMemory`, `deleteMemory`, `clearAllMemories`), `MemoryView.vue` | Mock array with 2 sample records. No search scoring, retention toggle enforcement, agent scoping, or DB storage. |
| **Chat & Agent Runtime** | `IN-MEMORY / MOCK` | `store.ts` (`sendChatMessage`, `clearChatMessages`), `ChatView.vue` | Canned response path using `setTimeout(r, 600)` and substring matching (`stage`, `who are you`, `memory`). No real model calls. |
| **Avatar Stage Coordination** | `PERSISTED & WORKING` | `apps/desktop/electron/main/index.ts`, `stage-main.ts`, `stage.html` | Independent transparent window, native IPC, cursor tracking, VRM loading, side-mounted kebab menu, and window presets. |

---

## 2. As-Is Architecture vs. Target Architecture

### 2.1 As-Is Architecture (Current Checkout)

```mermaid
flowchart TB
    subgraph VueRenderer["Vue 3 Renderer (Workspace Window)"]
        UI_Views["Workspace Views (Chat, Agents, Memory, Tools, etc.)"]
        AppStore["store.ts (Reactive In-Memory State)"]
        SampleData["Hardcoded Sample Arrays\n(agents, skills, rules, tools, memories)"]
        MockChat["Canned Chat Path\n(setTimeout + keyword matching)"]
        MockTest["Simulated testConnection()\n(setTimeout 400ms -> ready)"]
        
        UI_Views --> AppStore
        AppStore --> SampleData
        AppStore --> MockChat
        AppStore --> MockTest
    end

    subgraph ElectronMain["Electron Main Process (Trusted)"]
        MainWindow["Workspace BrowserWindow"]
        StageWindow["Avatar Stage BrowserWindow"]
        IpcRouter["IPC Handlers & Security Sender Validation"]
        EmbeddedServer["Embedded Server Lifecycle\n(http://127.0.0.1:3000)"]
    end

    subgraph LocalServer["Local Service & Storage (Node.js 22)"]
        HttpServer["server.ts (REST API & Rate Limiting)"]
        AuthService["auth-service.ts (Users, Sessions, Secrets)"]
        SQLiteDB["database.ts (DatabaseSync node:sqlite)\nTables: users, profiles, sessions, vault, logs"]
    end

    AppStore -.->|"fetch() for Auth & Secrets only"| HttpServer
    HttpServer --> AuthService
    AuthService --> SQLiteDB
    AppStore -.->|"Desktop API (Electron IPC)"| IpcRouter
    IpcRouter --> StageWindow
```

### 2.2 Target Architecture (Companion Domain Implementation)

```mermaid
flowchart TB
    subgraph VueRenderer["Vue 3 Renderer (Workspace Window)"]
        UI_Components["Workspace Views (Chat, Agents, Skills, Rules, Tools, Memory)"]
        AppStoreCore["useAppStore() (Connected to Real Domain Services)"]
        ApiTransport["API & IPC Transport Client"]
        
        UI_Components --> AppStoreCore
        AppStoreCore --> ApiTransport
    end

    subgraph ElectronMain["Electron Main Process (Trusted Boundary)"]
        SecurityGate["IPC Sender & CSP Security Gates"]
        AppLifecycle["Window Lifecycle & Multi-Window Sync"]
        StageController["Avatar Stage IPC & Gaze Tracking"]
    end

    subgraph RuntimeLayer["Trusted Domain Runtime (Main / Local Service)"]
        AuthModule["AuthService (Sessions, Users, Safe Credentials)"]
        DomainService["Companion Domain Repositories\n(Agents, Skills, Rules, Tools, Memories)"]
        PromptCompiler["Deterministic Request Composer\n(System Policy + Agent + Rules + Skills + Tools + Memory)"]
        ToolRegistry["Allowlisted Tool Registry & Approval Gate"]
        ModelAdapterRouter["Model Provider Adapters\n(Gemini, OpenAI, Anthropic)"]
        VaultDecrypt["Hardware Vault Decryptor\n(AES-256-GCM Envelope)"]
    end

    subgraph StorageLayer["SQLite Storage (node:sqlite DatabaseSync)"]
        CoreAuthTables["Account & Vault Tables\n(users, user_profiles, sessions, user_secrets_vault)"]
        DomainTables["Companion Domain Tables\n(agents, skills, rules, tools, memories, conversations, chat_messages)"]
    end

    ApiTransport -->|"Loopback HTTP / Typed IPC"| SecurityGate
    SecurityGate --> DomainService
    SecurityGate --> AuthModule
    DomainService --> DomainTables
    AuthModule --> CoreAuthTables
    DomainService --> PromptCompiler
    PromptCompiler --> ModelAdapterRouter
    ToolRegistry --> PromptCompiler
    VaultDecrypt -->|"Plaintext key in trusted memory only"| ModelAdapterRouter
    ModelAdapterRouter -->|"External TLS API Request"| CloudProviders["AI Provider APIs\n(Google Gemini, OpenAI, Anthropic)"]
```

---

## 3. Entity-Relationship Model (Current vs. Proposed)

```mermaid
erDiagram
    %% ==========================================
    %% CURRENT EXISTING TABLES (PERSISTED & REAL)
    %% ==========================================
    users {
        TEXT id PK
        TEXT email UK
        TEXT password_hash
        TEXT status
        INTEGER failed_login_attempts
        TEXT lockout_until
        TEXT created_at
        TEXT updated_at
    }

    user_profiles {
        TEXT user_id PK, FK
        TEXT display_name
        TEXT avatar_url
        TEXT locale
        TEXT timezone
        TEXT updated_at
    }

    sessions {
        TEXT id PK
        TEXT user_id FK
        TEXT token_hash UK
        TEXT client_type
        TEXT device_name
        TEXT ip_subnet
        TEXT idle_expires_at
        TEXT absolute_expires_at
        TEXT revoked_at
        TEXT created_at
        TEXT last_seen_at
    }

    password_reset_tokens {
        TEXT id PK
        TEXT user_id FK
        TEXT token_hash UK
        TEXT expires_at
        TEXT used_at
        TEXT ip_subnet
        TEXT created_at
    }

    user_secrets_vault {
        TEXT id PK
        TEXT user_id FK
        TEXT provider
        TEXT ciphertext
        TEXT nonce
        TEXT tag
        TEXT key_hint
        TEXT created_at
        TEXT updated_at
    }

    audit_logs {
        TEXT id PK
        TEXT user_id
        TEXT event_type
        TEXT status
        TEXT ip_subnet
        TEXT user_agent_summary
        TEXT metadata
        TEXT created_at
    }

    %% ==========================================
    %% PROPOSED COMPANION DOMAIN TABLES (PHASE 01)
    %% ==========================================
    agents {
        TEXT id PK
        TEXT user_id FK
        TEXT name
        TEXT description
        TEXT personality
        TEXT conversational_style
        TEXT system_instructions
        TEXT preferred_provider
        TEXT preferred_model
        TEXT behavior_preferences
        INTEGER is_active
        TEXT created_at
        TEXT updated_at
    }

    skills {
        TEXT id PK
        TEXT user_id FK
        TEXT name
        TEXT description
        TEXT category
        TEXT content
        INTEGER enabled
        TEXT created_at
        TEXT updated_at
    }

    agent_skills {
        TEXT agent_id PK, FK
        TEXT skill_id PK, FK
        TEXT created_at
    }

    rules {
        TEXT id PK
        TEXT user_id FK
        TEXT name
        TEXT content
        TEXT scope
        TEXT applicable_agent_id FK
        INTEGER priority
        INTEGER enabled
        TEXT created_at
        TEXT updated_at
    }

    tools {
        TEXT id PK
        TEXT user_id FK
        TEXT name
        TEXT description
        TEXT category
        TEXT permission_level
        INTEGER requires_confirmation
        INTEGER enabled
        TEXT status
        TEXT created_at
        TEXT updated_at
    }

    agent_tools {
        TEXT agent_id PK, FK
        TEXT tool_id PK, FK
        TEXT created_at
    }

    memories {
        TEXT id PK
        TEXT user_id FK
        TEXT agent_id FK
        TEXT category
        TEXT content
        REAL confidence
        TEXT last_recalled_at
        TEXT created_at
        TEXT updated_at
    }

    conversations {
        TEXT id PK
        TEXT user_id FK
        TEXT agent_id FK
        TEXT title
        TEXT created_at
        TEXT updated_at
    }

    chat_messages {
        TEXT id PK
        TEXT conversation_id FK
        TEXT user_id FK
        TEXT agent_id FK
        TEXT role
        TEXT content
        TEXT status
        INTEGER token_count
        TEXT created_at
    }

    user_provider_settings {
        TEXT id PK
        TEXT user_id FK
        TEXT provider UK
        TEXT selected_model
        TEXT available_models
        TEXT status
        TEXT error_message
        TEXT updated_at
    }

    %% Relationships & Foreign Keys
    users ||--|| user_profiles : "has"
    users ||--o{ sessions : "creates"
    users ||--o{ password_reset_tokens : "requests"
    users ||--o{ user_secrets_vault : "owns"
    users ||--o{ agents : "configures"
    users ||--o{ skills : "manages"
    users ||--o{ rules : "defines"
    users ||--o{ tools : "customizes"
    users ||--o{ memories : "stores"
    users ||--o{ conversations : "holds"
    users ||--o{ user_provider_settings : "maintains"

    agents ||--o{ agent_skills : "attaches"
    skills ||--o{ agent_skills : "linked_to"
    agents ||--o{ agent_tools : "attaches"
    tools ||--o{ agent_tools : "linked_to"
    agents ||--o{ rules : "applies_agent_rule"
    agents ||--o{ memories : "scoped_to"
    conversations ||--o{ chat_messages : "contains"
```

---

## 4. Key Sequence Diagrams

### 4.1 Authentication & Session Resolution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Vue as Vue Workspace
    participant IPC as Electron Main / IPC Bridge
    participant Server as Embedded Auth Server
    participant DB as SQLite (node:sqlite)
    participant SafeStore as Electron safeStorage

    User->>Vue: Submit Email + Password
    Vue->>IPC: invoke("app:auth-login", { email, password, deviceName })
    IPC->>Server: POST /api/v1/auth/desktop-login
    Server->>DB: Query user by email (COLLATE NOCASE)
    DB-->>Server: User record + password_hash
    Server->>Server: Verify scrypt password hash
    Server->>DB: Insert new session record
    DB-->>Server: OK
    Server-->>IPC: Return { user, refreshToken, accessToken }
    IPC->>SafeStore: encryptString(refreshToken)
    SafeStore-->>IPC: Encrypted buffer
    IPC->>IPC: Persist to app.getPath("userData")/session.enc
    IPC-->>Vue: Return { user }
    Vue->>Vue: Set isAuthenticated = true, render companion workspace
```

### 4.2 Provider-Backed Chat Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Vue as ChatView / AppStore
    participant Main as Electron Main Runtime
    participant Composer as Prompt & Context Composer
    participant MemorySvc as Memory Retrieval Engine
    participant Vault as Hardware Secret Vault
    participant Adapter as Provider Adapter (Gemini/OpenAI/Anthropic)
    participant ProviderAPI as AI Provider Cloud Endpoint
    participant DB as SQLite Storage

    User->>Vue: Enters message: "Explain quantum superposition"
    Vue->>DB: Persist user message to chat_messages (status: "sending")
    Vue->>Main: invoke("chat:send-message", { messageId, agentId, conversationId })
    Main->>DB: Query active Agent configuration & preferences
    DB-->>Main: AgentProfile (systemInstructions, preferredModel, provider)
    
    alt Memory Retention Enabled
        Main->>MemorySvc: Retrieve relevant memories (query, userId, agentId)
        MemorySvc->>DB: Lexical / keyword search query on memories
        DB-->>MemorySvc: Relevant memory records
        MemorySvc-->>Composer: Scored memory excerpts
    end

    Main->>Composer: Compose prompt(Base Safety, Agent Persona, Rules, Skills, Tools, Memory, History)
    Composer-->>Main: Assembled request payload + Tool definitions

    Main->>Vault: Retrieve provider key (userId, provider)
    Vault->>DB: Read ciphertext, nonce, tag from user_secrets_vault
    DB-->>Vault: Encrypted secret payload
    Vault->>Vault: Decrypt using AES-256-GCM master key
    Vault-->>Adapter: Decrypted API key (scoped to trusted memory)

    Main->>Adapter: executeRequest(modelId, payload, apiKey, abortSignal)
    Adapter->>ProviderAPI: HTTPS POST /v1/chat/completions (or generateContent)
    ProviderAPI-->>Adapter: Model completion response
    Adapter-->>Main: Standardized Assistant Response

    Main->>DB: Persist assistant response to chat_messages (status: "complete")
    Main-->>Vue: Return Assistant ChatMessage
    Vue->>Vue: Append response to timeline, update stage emotions if needed
```

---

## 5. Flow Diagrams: Prompt Composition & Tool Execution

### 5.1 Deterministic Effective Prompt Composition

The prompt compiler combines untrusted user text, configuration, and policies in a deterministic, tested precedence order. Private keys, other users' data, and irrelevant memories are strictly excluded:

```mermaid
flowchart TD
    Start([Assemble Context]) --> L1[Layer 1: Invariant Application Safety Policy\n- Cannot be overridden by user or model\n- Desktop environment boundaries\n- Truthful tool & privacy disclaimers]
    L1 --> L2[Layer 2: Active Agent Persona & Instructions\n- Agent name & description\n- Personality & conversational style\n- agent.systemInstructions text]
    L2 --> L3[Layer 3: Applicable Enabled Rules\n- Global rules in ascending priority order\n- Agent-specific rules in ascending priority order\n- Disabled rules excluded]
    L3 --> L4[Layer 4: Enabled Associated Skills\n- Routine instructions & operational guides\n- Unassociated/disabled skills excluded]
    L4 --> L5[Layer 5: Tool Definition Schemas\n- JSON schema for registered allowlisted tools\n- Expressed as provider function declarations]
    L5 --> L6{Memory Retention\nEnabled?}
    L6 -->|Yes| L6A[Layer 6: Retrieved Relevant Memory\n- Max items: 5, bounded character count\n- Scoped strictly to authenticated user\n- Formatted as untrusted user context]
    L6 -->|No| L6B[Skip Memory Injection]
    L6A --> L7[Layer 7: Conversation History\n- Sliding window of recent messages\n- User / Assistant message sequence]
    L6B --> L7
    L7 --> FinalPrompt([Final Model Request Payload])
```

### 5.2 Tool Authorization & User Confirmation Boundary

```mermaid
flowchart TD
    ModelOutput([Model Requests Function Call]) --> ParseCall[Parse Tool ID & Arguments]
    ParseCall --> CheckRegistry{Is Tool Registered\nin Allowlist?}
    CheckRegistry -->|No| RejectNotFound[Reject: Tool Not Found\nReturn error to model]
    CheckRegistry -->|Yes| CheckEnabled{Is Tool Enabled\nfor this Agent?}
    CheckEnabled -->|No| RejectDisabled[Reject: Tool Disabled by User\nReturn error to model]
    CheckEnabled -->|Yes| ValidateSchema{Validate Arguments\nAgainst JSON Schema}
    ValidateSchema -->|Invalid| RejectSchema[Reject: Invalid Arguments\nReturn validation error]
    ValidateSchema -->|Valid| CheckPermission{Requires User\nConfirmation?}
    
    CheckPermission -->|Yes| ShowPrompt[Display Confirmation Modal in Workspace\nDetails: Action, Params, Risk]
    ShowPrompt --> UserDecision{User Approves?}
    UserDecision -->|Rejected| CancelAction[Abort Action\nReturn 'User Declined' to model]
    UserDecision -->|Approved| ExecuteHandler[Execute Registered Native Handler\nin Trusted Main Process]
    
    CheckPermission -->|No| ExecuteHandler
    ExecuteHandler --> ReturnResult[Format Clean JSON Result\nInject into Conversation as Tool Output]
```

---

## 6. Security Architecture & Data Ownership

### 6.1 Trust Boundaries & Process Isolation
1. **Renderer Process (Workspace & Stage):**
   - Strictly isolated with `contextIsolation: true` and `nodeIntegration: false`.
   - Accesses backend capabilities exclusively via narrow, typed IPC bridges or loopback HTTP.
   - Never receives raw database connections, master keys, full provider API keys, or unrestricted Node.js APIs.
2. **Main Process & Local Service (Trusted Layer):**
   - Owns the SQLite database (`DatabaseSync`) and master encryption key.
   - Enforces IPC sender validation using `validateIpcSender(event.sender, allowedWindows)`.
   - Performs envelope decryption of provider secrets only immediately before dispatching HTTPS requests to provider endpoints.
   - Resolves authenticated identity from verified session tokens; never accepts client-provided `userId` parameters as proof of identity.

### 6.2 Data Isolation & Cascade Policy
- Every domain record (`agents`, `skills`, `rules`, `tools`, `memories`, `conversations`, `chat_messages`, `user_provider_settings`) has a foreign key to `users(id)` with `ON DELETE CASCADE`.
- Account deletion requires verifying the current password and typing the explicit confirmation phrase (`DELETE MY ACCOUNT`).
- All queries in the domain repositories must include `WHERE user_id = ?` to enforce complete multi-tenant tenant isolation.

---

## 7. Official References & Standards

1. **Electron Security Guidelines:**  
   [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — Context isolation, disabling `nodeIntegration`, CSP enforcement, and IPC sender verification.
2. **Node.js SQLite Integration:**  
   [Node.js v22 `node:sqlite` Module](https://nodejs.org/api/sqlite.html) — Synchronous SQLite engine (`DatabaseSync`), WAL mode, parameterized statements, and transaction management.
3. **Google Gemini API Documentation:**  
   [Gemini API Reference](https://ai.google.dev/gemini-api/docs) — Structured text generation, model IDs (`gemini-2.5-flash`, `gemini-2.5-pro`), and system instruction configuration.
4. **OpenAI API Documentation:**  
   [OpenAI API Reference](https://platform.openai.com/docs/api-reference) — Chat completions API (`gpt-4o`, `gpt-4o-mini`), tool calling schemas, and error taxonomy.
5. **Anthropic Claude API Documentation:**  
   [Anthropic API Reference](https://docs.anthropic.com/en/api) — Messages API (`claude-3-5-sonnet`, `claude-3-5-haiku`), system prompts, and tool use formats.
