# F06 — Chat and Conversation

## 1. Functional Scope & Purpose
F06 manages real-time conversational messaging between the user and the active AI companion. It governs message submission, deterministic multi-layer context assembly, LLM request execution, finite timeouts, cancellation, error recovery, and conversation persistence.

## 2. Current Implementation & Confirmed Defect Status
- **Endpoint:** `POST /api/v1/chat/completions` in `server.ts:636`.
- **Context Bounds:** Conversation history window truncated to the last 12 messages (`companionRepo.listMessages(userId, conversationId, 12)`), preventing context explosion while maintaining immediate dialogue flow.
- **Defect P1 (Remediated):** Formerly had no finite timeout or cancellation handling. Remediated with a 30-second default request deadline (`AbortController`), cancellation on client socket close (`req.on("close")`), and structured HTTP status normalization (504 timeout, 429 rate limit, 401 provider auth error).
- **History Management:** `GET /api/v1/chat/messages` and `POST /api/v1/chat/clear` for resetting conversations.

## 3. Requirements & Acceptance Criteria
- AC-01: Message submission must persist user messages before provider dispatch.
- AC-02: Stalled provider calls must abort within 30 seconds and return a clear timeout error.
- AC-03: Client cancellation must propagate to abort the outgoing provider request.
- AC-04: Chat history must be bounded to 12 turns.
- AC-05: Loading states in UI must always resolve cleanly, even upon provider failure.
