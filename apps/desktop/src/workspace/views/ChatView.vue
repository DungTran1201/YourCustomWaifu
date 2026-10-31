<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from "vue";
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
  preferredProvider: "gemini" as const,
};

const activeAgent = computed(() => {
  return (
    store.state.agents.find((a) => a.id === store.state.activeAgentId) ||
    store.state.agents[0] ||
    defaultAgent
  );
});

// --- Dynamic Model Selector State ---
const isModelMenuOpen = ref(false);
const modelDropdownRef = ref<HTMLDivElement | null>(null);

const modelGroups = computed(() => {
  return store.state.modelConnections.map((conn) => {
    const hasKey = store.state.secrets.some(
      (s) => s.provider === conn.provider,
    );
    return {
      provider: conn.provider as "gemini" | "openai" | "anthropic",
      displayName: conn.displayName,
      hasKey,
      models:
        conn.availableModels && conn.availableModels.length > 0
          ? conn.availableModels
          : [conn.selectedModel],
      selectedModel: conn.selectedModel,
    };
  });
});

function toggleModelDropdown() {
  isModelMenuOpen.value = !isModelMenuOpen.value;
}

async function selectModel(
  model: string,
  provider: "gemini" | "openai" | "anthropic",
) {
  isModelMenuOpen.value = false;
  await store.setChatModel(model, provider);
}

function onNativeSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const chosenModel = target.value;
  for (const group of modelGroups.value) {
    if (group.models.includes(chosenModel)) {
      selectModel(chosenModel, group.provider);
      return;
    }
  }
}

function navigateToKeys() {
  isModelMenuOpen.value = false;
  store.setTab("secrets");
}

function handleClickOutside(event: MouseEvent) {
  if (
    isModelMenuOpen.value &&
    modelDropdownRef.value &&
    !modelDropdownRef.value.contains(event.target as Node)
  ) {
    isModelMenuOpen.value = false;
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isModelMenuOpen.value) {
    isModelMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleGlobalKeydown);
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

        <!-- Interactive Model Selector -->
        <div ref="modelDropdownRef" class="model-selector-container">
          <button
            id="chat-model-selector-btn"
            type="button"
            class="model-selector-trigger"
            :class="{ 'is-open': isModelMenuOpen }"
            :title="`Active model: ${activeAgent.preferredModel}. Click to switch.`"
            aria-haspopup="listbox"
            :aria-expanded="isModelMenuOpen"
            @click.stop="toggleModelDropdown"
          >
            <span
              class="provider-dot"
              :class="`dot-${activeAgent.preferredProvider || 'gemini'}`"
            ></span>
            <span class="model-name-text">{{
              activeAgent.preferredModel
            }}</span>
            <span
              class="model-chevron"
              :class="{ 'chevron-rotated': isModelMenuOpen }"
            >
              <AppIcon name="chevron-down" size="12" />
            </span>
          </button>

          <!-- Accessible native select for testing & keyboard navigation -->
          <select
            id="chat-model-select"
            class="model-native-select"
            :value="activeAgent.preferredModel"
            aria-label="Select AI Model"
            @change="onNativeSelectChange"
          >
            <optgroup
              v-for="group in modelGroups"
              :key="group.provider"
              :label="`${group.displayName} ${group.hasKey ? '(Key Ready)' : '(No Key)'}`"
            >
              <option v-for="m in group.models" :key="m" :value="m">
                {{ m }}
              </option>
            </optgroup>
          </select>

          <!-- Custom Floating Dropdown Menu -->
          <transition name="dropdown-fade">
            <div
              v-if="isModelMenuOpen"
              id="chat-model-dropdown-menu"
              class="model-dropdown-menu"
              role="listbox"
            >
              <div class="dropdown-header">
                <span class="dropdown-header-title">Active AI Model</span>
                <span class="dropdown-header-hint">Instant switch</span>
              </div>

              <div class="dropdown-groups">
                <div
                  v-for="group in modelGroups"
                  :key="group.provider"
                  class="model-provider-group"
                >
                  <div class="provider-group-header">
                    <span class="provider-group-name">{{
                      group.displayName
                    }}</span>
                    <span
                      class="provider-key-status"
                      :class="
                        group.hasKey ? 'status-linked' : 'status-unlinked'
                      "
                    >
                      {{ group.hasKey ? "Key Linked" : "No Key" }}
                    </span>
                  </div>

                  <div class="provider-models-list">
                    <button
                      v-for="m in group.models"
                      :key="m"
                      :id="'model-option-' + m.replace(/\./g, '-')"
                      type="button"
                      class="model-option-btn"
                      :class="{
                        'is-selected': activeAgent.preferredModel === m,
                      }"
                      role="option"
                      :aria-selected="activeAgent.preferredModel === m"
                      @click="selectModel(m, group.provider)"
                    >
                      <div class="model-option-content">
                        <span class="model-id">{{ m }}</span>
                        <span
                          v-if="m === 'gemini-2.5-flash'"
                          class="model-badge badge-recommended"
                          >Recommended</span
                        >
                        <span
                          v-else-if="
                            m.includes('pro') ||
                            m.includes('sonnet') ||
                            m.includes('4o')
                          "
                          class="model-badge badge-pro"
                          >High Intelligence</span
                        >
                      </div>
                      <AppIcon
                        v-if="activeAgent.preferredModel === m"
                        name="check"
                        size="13"
                        class="check-icon"
                      />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Footer with key vault link -->
              <div class="dropdown-footer">
                <button
                  id="chat-manage-keys-btn"
                  type="button"
                  class="manage-keys-link"
                  @click="navigateToKeys"
                >
                  <AppIcon name="secrets" size="13" />
                  <span>Configure API Keys in Vault &rarr;</span>
                </button>
              </div>
            </div>
          </transition>
        </div>
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
            Your personal companion is ready. Active model:
            <button
              id="empty-state-model-btn"
              type="button"
              class="model-code-btn"
              title="Click to switch model"
              @click.stop="toggleModelDropdown"
            >
              <code class="model-code">{{ activeAgent.preferredModel }}</code>
              <AppIcon name="chevron-down" size="11" />
            </button>
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
  min-width: 0;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
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
  flex-shrink: 0;
}

.agent-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
}

.agent-headline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.agent-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
  flex-shrink: 0;
}

.agent-subtitle {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Model Selector */
.model-selector-container {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.model-selector-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 9px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.74rem;
  font-family: var(--font-family-mono);
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.model-selector-trigger:hover {
  background: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.model-selector-trigger.is-open {
  border-color: #06b6d4;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  background: var(--bg-hover);
}

.provider-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.dot-gemini {
  background: #06b6d4;
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.6);
}

.dot-openai {
  background: #10a37f;
  box-shadow: 0 0 6px rgba(16, 163, 127, 0.6);
}

.dot-anthropic {
  background: #d97706;
  box-shadow: 0 0 6px rgba(217, 119, 6, 0.6);
}

.model-name-text {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.model-chevron {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.model-chevron.chevron-rotated {
  transform: rotate(180deg);
  color: var(--text-primary);
}

/* Native select for accessibility / automation */
.model-native-select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  pointer-events: none;
}

/* Floating Dropdown */
.model-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 310px;
  max-height: 420px;
  overflow-y: auto;
  background: #12151c;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  padding: 8px;
  z-index: 100;
  backdrop-filter: blur(16px);
  animation: dropdownIn 0.15s ease-out;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 8px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 6px;
}

.dropdown-header-title {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dropdown-header-hint {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.dropdown-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-provider-group {
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.model-provider-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.provider-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  margin-bottom: 2px;
}

.provider-group-name {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.provider-key-status {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 9999px;
  font-weight: 500;
}

.provider-key-status.status-linked {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.provider-key-status.status-unlinked {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.provider-models-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-option-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
  font-family: var(--font-family-mono);
}

.model-option-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.model-option-btn.is-selected {
  background: rgba(6, 182, 212, 0.12);
  border-color: rgba(6, 182, 212, 0.35);
  color: #06b6d4;
  font-weight: 600;
}

.model-option-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.model-id {
  font-size: 0.75rem;
  white-space: nowrap;
}

.model-badge {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--font-family-sans);
  font-weight: 500;
}

.badge-recommended {
  background: rgba(6, 182, 212, 0.18);
  color: #06b6d4;
}

.badge-pro {
  background: rgba(168, 85, 247, 0.18);
  color: #a855f7;
}

.check-icon {
  color: #06b6d4;
  flex-shrink: 0;
}

.dropdown-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.manage-keys-link {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.manage-keys-link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-default);
}

/* Empty state clickable model code button */
.model-code-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  vertical-align: middle;
}

.model-code-btn .model-code {
  transition: all var(--transition-fast);
}

.model-code-btn:hover .model-code {
  background: var(--bg-hover);
  color: #06b6d4;
  border-color: rgba(6, 182, 212, 0.4);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.chat-stream-column {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* Empty State */
.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
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
  overflow-wrap: anywhere;
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
  width: 100%;
  min-width: 0;
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
  gap: 8px;
}

.toolbar-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.composer-send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.composer-send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Chat Responsive Media Queries */
@media (max-width: 640px) {
  .agent-subtitle {
    display: none;
  }
  .chat-action-btn span {
    display: none;
  }
  .chat-action-btn {
    padding: 4px;
  }
  .message-bubble {
    max-width: 92%;
  }
}

@media (max-height: 650px) {
  .chat-empty-state {
    padding: 14px 12px;
  }
  .empty-icon-shield {
    width: 34px;
    height: 34px;
    margin-bottom: 8px;
  }
  .empty-title {
    font-size: 0.95rem;
    margin-bottom: 4px;
  }
  .empty-description {
    font-size: 0.78rem;
    margin-bottom: 12px;
  }
  .quick-prompts-container {
    gap: 6px;
  }
  .quick-prompt-chip {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
}
</style>
