<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();
const messageContainer = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const defaultAgent = {
  id: "agent_aiko",
  name: "Aiko",
  personality: "Warm, perceptive, and supportive",
  preferredModel: "gemini-2.5-flash",
};

const activeAgent = computed(() => {
  return (
    store.state.agents.find((a) => a.id === store.state.activeAgentId) ||
    store.state.agents[0] ||
    defaultAgent
  );
});

const quickPrompts = [
  "What tasks should we focus on today?",
  "Can you help me brainstorm ideas?",
  "Review my open objectives and reminders.",
];

function setQuickPrompt(promptText: string) {
  store.state.chatInput = promptText;
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

function scrollToBottom() {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
  });
}

watch(
  () => store.state.messages.length,
  () => {
    scrollToBottom();
  },
);

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!store.state.chatSending && store.state.chatInput.trim()) {
      store.sendChatMessage();
    }
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function copyMessage(text: string) {
  navigator.clipboard.writeText(text);
}
</script>

<template>
  <div class="chat-workspace">
    <!-- Header / Context bar -->
    <header class="chat-header">
      <div class="header-left">
        <div class="agent-avatar-badge">🤖</div>
        <div class="agent-info">
          <div class="agent-headline">
            <span class="agent-name">{{ activeAgent.name }}</span>
            <span class="agent-status-dot"></span>
          </div>
          <span class="agent-badge">{{ activeAgent.personality }}</span>
        </div>
        <span class="model-tag">{{ activeAgent.preferredModel }}</span>
      </div>

      <div class="header-actions">
        <button
          id="chat-clear-history-btn"
          class="chat-action-btn"
          title="Clear Conversation History"
          @click="store.clearChatMessages()"
        >
          Clear History
        </button>
      </div>
    </header>

    <!-- Message stream area (Minimal Dark Productivity, strictly no anime images) -->
    <div
      ref="messageContainer"
      class="chat-messages"
      role="log"
      aria-live="polite"
    >
      <!-- Empty State with Quick Starter Prompts -->
      <div v-if="store.state.messages.length === 0" class="chat-empty-state">
        <div class="empty-icon-shield">💬</div>
        <h3>Begin your conversation with {{ activeAgent.name }}</h3>
        <p>
          Attentive personal desktop companion connected via
          <code class="model-code">{{ activeAgent.preferredModel }}</code
          >.
        </p>

        <div class="quick-prompts-container">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="quick-prompt-chip"
            @click="setQuickPrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <!-- Messages List -->
      <div
        v-for="msg in store.state.messages"
        :key="msg.id"
        :class="[
          'message-row',
          msg.role === 'user' ? 'user-row' : 'assistant-row',
        ]"
      >
        <div class="message-bubble">
          <div class="message-meta">
            <span class="role-label">{{
              msg.role === "user" ? "You" : activeAgent.name
            }}</span>
            <div class="meta-right">
              <span class="time-label">{{ formatTime(msg.timestamp) }}</span>
              <button
                class="copy-msg-btn"
                title="Copy message"
                @click="copyMessage(msg.content)"
              >
                📋
              </button>
            </div>
          </div>
          <div class="message-content">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="store.state.chatSending" class="message-row assistant-row">
        <div class="message-bubble loading-bubble">
          <span class="loading-label">{{ activeAgent.name }} is thinking</span>
          <div class="typing-dots">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error message if any -->
    <div v-if="store.state.chatError" class="chat-error-bar">
      <span>⚠️ {{ store.state.chatError }}</span>
      <button class="error-dismiss-btn" @click="store.state.chatError = null">
        ✕
      </button>
    </div>

    <!-- Message Composer -->
    <div class="chat-composer-container">
      <div class="composer-box">
        <textarea
          id="chat-composer-input"
          ref="textareaRef"
          v-model="store.state.chatInput"
          class="composer-textarea"
          rows="2"
          placeholder="Message your companion... (Enter to send, Shift+Enter for newline)"
          :disabled="store.state.chatSending"
          @keydown="handleKeydown"
        ></textarea>

        <div class="composer-toolbar">
          <div class="toolbar-hint">
            <span
              >Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd> +
              <kbd>Enter</kbd> for newline</span
            >
          </div>

          <div class="toolbar-buttons">
            <button
              id="chat-send-btn"
              class="composer-send-btn"
              :disabled="
                store.state.chatSending || !store.state.chatInput.trim()
              "
              @click="store.sendChatMessage()"
            >
              {{ store.state.chatSending ? "Sending..." : "Send Message" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 0;
}

.chat-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-avatar-badge {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-headline {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.agent-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
}

.agent-badge {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.model-tag {
  font-size: 0.72rem;
  font-family: var(--font-family-mono);
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
}

.chat-action-btn {
  padding: 5px 11px;
  font-size: 0.775rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chat-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: var(--border-default);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--bg-primary);
}

.chat-empty-state {
  margin: auto;
  text-align: center;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  padding: 24px 16px;
}

.empty-icon-shield {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  margin-bottom: 4px;
}

.chat-empty-state h3 {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.chat-empty-state p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.model-code {
  font-family: var(--font-family-mono);
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--accent-cyan);
  font-size: 0.8rem;
}

.quick-prompts-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  width: 100%;
}

.quick-prompt-chip {
  padding: 9px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.825rem;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.quick-prompt-chip:hover {
  background: var(--bg-hover);
  border-color: var(--accent-cyan);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.message-row {
  display: flex;
  width: 100%;
}

.user-row {
  justify-content: flex-end;
}

.assistant-row {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  line-height: 1.5;
  word-break: break-word;
  position: relative;
}

.user-row .message-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.assistant-row .message-bubble {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
  font-size: 0.72rem;
}

.role-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.meta-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-label {
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.copy-msg-btn {
  background: transparent;
  border: none;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.message-bubble:hover .copy-msg-btn {
  opacity: 1;
}

.message-content {
  font-size: 0.875rem;
  white-space: pre-wrap;
  color: var(--text-primary);
}

.loading-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
}

.loading-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.typing-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.typing-dot {
  width: 5px;
  height: 5px;
  background: var(--accent-cyan);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: scale(0.3);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.chat-error-bar {
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.12);
  border-top: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--accent-danger);
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-dismiss-btn {
  background: transparent;
  border: none;
  color: var(--accent-danger);
  cursor: pointer;
  font-size: 0.8rem;
}

.chat-composer-container {
  padding: 12px 20px 16px;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.composer-box {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color var(--transition-fast);
}

.composer-box:focus-within {
  border-color: var(--border-focus);
}

.composer-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--font-family-sans);
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.45;
}

.composer-textarea::placeholder {
  color: var(--text-muted);
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
}

kbd {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: var(--font-family-mono);
  font-size: 0.68rem;
}

.composer-send-btn {
  padding: 6px 16px;
  font-size: 0.825rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.composer-send-btn:hover:not(:disabled) {
  background: #ffffff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.composer-send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
