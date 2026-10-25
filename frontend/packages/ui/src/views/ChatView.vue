<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();
const messageContainer = ref<HTMLDivElement | null>(null);

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
    store.sendChatMessage();
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
</script>

<template>
  <div class="chat-workspace">
    <!-- Header / Context bar -->
    <header class="chat-header">
      <div class="header-left">
        <div class="agent-info">
          <span class="agent-name">{{ activeAgent.name }}</span>
          <span class="agent-badge">{{ activeAgent.personality }}</span>
        </div>
        <span class="model-tag">{{ activeAgent.preferredModel }}</span>
      </div>

      <div class="header-actions">
        <button
          id="chat-clear-history-btn"
          class="chat-action-btn"
          title="Clear Conversation"
          @click="store.clearChatMessages()"
        >
          Clear History
        </button>
      </div>
    </header>

    <!-- Message stream area (Text-focused, clean, no anime art) -->
    <div
      ref="messageContainer"
      class="chat-messages"
      role="log"
      aria-live="polite"
    >
      <div v-if="store.state.messages.length === 0" class="chat-empty-state">
        <h3>Begin your conversation</h3>
        <p>
          Send a message below to interact with your personal desktop companion.
        </p>
      </div>

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
            <span class="time-label">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-content">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="store.state.chatSending" class="message-row assistant-row">
        <div class="message-bubble loading-bubble">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    </div>

    <!-- Error message if any -->
    <div v-if="store.state.chatError" class="chat-error-bar">
      <span>{{ store.state.chatError }}</span>
    </div>

    <!-- Message Composer -->
    <div class="chat-composer-container">
      <div class="composer-box">
        <textarea
          id="chat-composer-input"
          v-model="store.state.chatInput"
          class="composer-textarea"
          rows="2"
          placeholder="Type a message or instruction... (Press Enter to send, Shift+Enter for newline)"
          :disabled="store.state.chatSending"
          @keydown="handleKeydown"
        ></textarea>

        <div class="composer-toolbar">
          <div class="toolbar-hint">
            <span>Shift + Enter for new line</span>
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
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.agent-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.model-tag {
  font-size: 0.75rem;
  font-family: var(--font-family-mono);
  color: var(--text-muted);
}

.chat-action-btn {
  padding: 5px 12px;
  font-size: 0.8rem;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.chat-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--bg-primary);
}

.chat-empty-state {
  margin: auto;
  text-align: center;
  max-width: 400px;
  color: var(--text-muted);
}

.chat-empty-state h3 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 8px;
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
  max-width: 75%;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  line-height: 1.5;
  word-break: break-word;
}

.user-row .message-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
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
  font-size: 0.75rem;
}

.role-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.time-label {
  color: var(--text-muted);
  font-family: var(--font-family-mono);
}

.message-content {
  font-size: 0.9rem;
  white-space: pre-wrap;
}

.loading-bubble {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 20px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  background: var(--text-muted);
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
    transform: scale(0);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.chat-error-bar {
  padding: 8px 24px;
  background: rgba(239, 68, 68, 0.15);
  border-top: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--accent-danger);
  font-size: 0.85rem;
}

.chat-composer-container {
  padding: 16px 24px 20px;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.composer-box {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px;
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
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.4;
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
  font-size: 0.75rem;
  color: var(--text-muted);
}

.composer-send-btn {
  padding: 7px 18px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background: #f1f2f4;
  color: #101114;
  transition: all var(--transition-fast);
}

.composer-send-btn:hover:not(:disabled) {
  background: #ffffff;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
}

.composer-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
