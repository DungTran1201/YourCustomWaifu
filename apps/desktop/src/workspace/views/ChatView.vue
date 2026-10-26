<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import { useAppStore } from "@vrm/app-core";
import AppIcon from "../../components/AppIcon.vue";

const store = useAppStore();
const messageContainer = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const copiedMsgId = ref<string | null>(null);

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
  "Review my open objectives and reminders.",
  "Can you help me brainstorm ideas?",
];

function setQuickPrompt(promptText: string) {
  store.state.chatInput = promptText;
  nextTick(() => {
    adjustTextareaHeight();
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

function adjustTextareaHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = "auto";
    const newHeight = Math.min(textareaRef.value.scrollHeight, 160);
    textareaRef.value.style.height = `${Math.max(newHeight, 44)}px`;
  }
}

function handleInput() {
  adjustTextareaHeight();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!store.state.chatSending && store.state.chatInput.trim()) {
      store.sendChatMessage();
      nextTick(() => {
        if (textareaRef.value) {
          textareaRef.value.style.height = "44px";
        }
      });
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

async function copyMessage(id: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedMsgId.value = id;
    setTimeout(() => {
      if (copiedMsgId.value === id) {
        copiedMsgId.value = null;
      }
    }, 1800);
  } catch {
    // Clipboard permission fallback
  }
}
</script>

<template>
  <div class="chat-workspace">
    <!-- Minimalist Header -->
    <header class="chat-header">
      <div class="header-left">
        <div class="agent-avatar-badge" aria-hidden="true">
          <AppIcon name="bot" size="15" />
        </div>
        <div class="agent-meta">
          <div class="agent-headline">
            <span class="agent-name">{{ activeAgent.name }}</span>
            <span class="agent-status-dot" title="Active"></span>
          </div>
          <span class="agent-subtitle">{{ activeAgent.personality }}</span>
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
          <AppIcon name="trash" size="13" />
          <span>Clear History</span>
        </button>
      </div>
    </header>

    <!-- Message Stream Area: max-width centered column -->
    <div
      ref="messageContainer"
      class="chat-messages"
      role="log"
      aria-live="polite"
    >
      <div class="chat-stream-column">
        <!-- Empty State with Quick Prompts -->
        <div v-if="store.state.messages.length === 0" class="chat-empty-state">
          <div class="empty-icon-shield" aria-hidden="true">
            <AppIcon name="chat" size="28" stroke-width="1.5" />
          </div>
          <h2 class="empty-title">Conversation with {{ activeAgent.name }}</h2>
          <p class="empty-description">
            Your personal companion is ready. Model:
            <code class="model-code">{{ activeAgent.preferredModel }}</code>
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
                  :title="
                    copiedMsgId === msg.id
                      ? 'Copied to clipboard'
                      : 'Copy message'
                  "
                  :aria-label="
                    copiedMsgId === msg.id ? 'Copied' : 'Copy message'
                  "
                  @click="copyMessage(msg.id, msg.content)"
                >
                  <AppIcon
                    :name="copiedMsgId === msg.id ? 'check' : 'copy'"
                    size="13"
                  />
                  <span v-if="copiedMsgId === msg.id" class="copied-label"
                    >Copied</span
                  >
                </button>
              </div>
            </div>
            <div class="message-content">
              {{ msg.content }}
            </div>
          </div>
        </div>

        <!-- Sending / Thinking State -->
        <div v-if="store.state.chatSending" class="message-row assistant-row">
          <div class="message-bubble loading-bubble">
            <span class="loading-label"
              >{{ activeAgent.name }} is thinking</span
            >
            <div class="typing-dots" aria-hidden="true">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="store.state.chatError" class="chat-error-bar" role="alert">
      <div class="error-content">
        <AppIcon name="alert" size="14" class="error-icon" />
        <span>{{ store.state.chatError }}</span>
      </div>
      <button
        class="error-dismiss-btn"
        title="Dismiss error"
        aria-label="Dismiss error"
        @click="store.state.chatError = null"
      >
        <AppIcon name="close" size="13" />
      </button>
    </div>

    <!-- Message Composer: Clean, centered, auto-growing -->
    <div class="chat-composer-container">
      <div class="composer-column">
        <div class="composer-box">
          <textarea
            id="chat-composer-input"
            ref="textareaRef"
            v-model="store.state.chatInput"
            class="composer-textarea"
            rows="1"
            placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
            :disabled="store.state.chatSending"
            @input="handleInput"
            @keydown="handleKeydown"
          ></textarea>

          <div class="composer-bottom-bar">
            <span class="toolbar-hint">
              <kbd>Enter</kbd> send &bull; <kbd>Shift+Enter</kbd> newline
            </span>

            <button
              id="chat-send-btn"
              class="composer-send-btn"
              :disabled="
                store.state.chatSending || !store.state.chatInput.trim()
              "
              :aria-label="
                store.state.chatSending ? 'Sending message' : 'Send message'
              "
              @click="store.sendChatMessage()"
            >
              <AppIcon name="send" size="14" />
              <span>{{ store.state.chatSending ? "Sending" : "Send" }}</span>
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
  position: relative;
}

.chat-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-primary);
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-avatar-badge {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.agent-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.agent-headline {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
}

.agent-subtitle {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.model-tag {
  font-size: 0.68rem;
  padding: 2px 7px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-family-mono);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chat-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: var(--border-subtle);
}

/* Messages area */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-stream-column {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Empty State */
.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  margin-top: auto;
  margin-bottom: auto;
}

.empty-icon-shield {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-description {
  font-size: 0.825rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.model-code {
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-surface);
  padding: 2px 5px;
  border-radius: 4px;
}

.quick-prompts-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-width: 580px;
}

.quick-prompt-chip {
  padding: 6px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-prompt-chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-default);
}

/* Message Rows */
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
  max-width: 82%;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  line-height: 1.55;
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
  margin-bottom: 4px;
  font-size: 0.72rem;
}

.role-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-label {
  color: var(--text-muted);
}

.copy-msg-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: transparent;
  color: var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: all var(--transition-fast);
}

.message-bubble:hover .copy-msg-btn,
.copy-msg-btn:focus-visible {
  opacity: 1;
}

.copy-msg-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.copied-label {
  font-size: 0.68rem;
  color: var(--accent-success);
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Loading bubble */
.loading-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
}

.loading-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.typing-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.typing-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: pulse 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* Error bar */
.chat-error-bar {
  max-width: 820px;
  margin: 0 auto 10px auto;
  width: calc(100% - 32px);
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.error-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  color: var(--accent-danger);
}

.error-dismiss-btn {
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}

.error-dismiss-btn:hover {
  color: var(--text-primary);
}

/* Composer */
.chat-composer-container {
  padding: 10px 16px 14px 16px;
  background: var(--bg-primary);
  flex-shrink: 0;
}

.composer-column {
  max-width: 820px;
  margin: 0 auto;
}

.composer-box {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color var(--transition-fast);
}

.composer-box:focus-within {
  border-color: rgba(255, 255, 255, 0.24);
}

.composer-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.45;
  resize: none;
  min-height: 44px;
  max-height: 160px;
}

.composer-textarea::placeholder {
  color: var(--text-muted);
}

.composer-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px solid var(--border-subtle);
}

.toolbar-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.toolbar-hint kbd {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.composer-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--text-primary);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.composer-send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.composer-send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
