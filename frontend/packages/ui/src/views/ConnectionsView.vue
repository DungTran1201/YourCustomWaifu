<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAppStore } from "@vrm/app-core";

const store = useAppStore();

const activeInputProvider = ref<string | null>(null);
const newApiKey = ref("");
const testingProvider = ref<string | null>(null);

onMounted(() => {
  store.fetchSecrets();
});

function getSecretHint(provider: string): string | null {
  const item = store.state.secrets.find((s) => s.provider === provider);
  return item ? item.keyHint : null;
}

async function handleSaveKey(provider: "gemini" | "openai" | "anthropic") {
  if (!newApiKey.value.trim()) return;
  await store.saveSecret(provider, newApiKey.value.trim());
  newApiKey.value = "";
  activeInputProvider.value = null;
  await store.testConnection(provider);
}

async function handleRemoveKey(provider: string) {
  await store.deleteSecret(provider);
}

async function handleTest(provider: "gemini" | "openai" | "anthropic") {
  testingProvider.value = provider;
  try {
    await store.testConnection(provider);
  } finally {
    testingProvider.value = null;
  }
}
</script>

<template>
  <div class="view-container">
    <div class="section-header">
      <div>
        <h2>AI Model Connections</h2>
        <p>
          Manage model providers, verified credentials, and active inference
          targets.
        </p>
      </div>
    </div>

    <!-- Security assurance -->
    <div class="security-banner">
      <span class="banner-icon">🔒</span>
      <p>
        Credentials are encrypted at rest via hardware-backed envelope
        cryptography and never exposed to the client.
      </p>
    </div>

    <div class="providers-list">
      <div
        v-for="conn in store.state.modelConnections"
        :key="conn.provider"
        class="provider-card"
      >
        <div class="provider-main">
          <div class="provider-info">
            <div class="provider-header-row">
              <h3 class="provider-name">{{ conn.displayName }}</h3>
              <span
                :class="[
                  'status-badge',
                  getSecretHint(conn.provider)
                    ? 'status-ready'
                    : 'status-not-configured',
                ]"
              >
                {{
                  getSecretHint(conn.provider)
                    ? conn.status === "ready"
                      ? "Ready"
                      : "Configured"
                    : "Not Configured"
                }}
              </span>
            </div>

            <p class="provider-desc">
              <span v-if="getSecretHint(conn.provider)">
                Key active: <code>{{ getSecretHint(conn.provider) }}</code>
              </span>
              <span v-else>
                No API key installed. Provide a valid key to activate this model
                provider.
              </span>
            </p>
          </div>

          <div class="provider-actions">
            <template v-if="getSecretHint(conn.provider)">
              <button
                :id="`test-conn-${conn.provider}`"
                class="btn-secondary"
                :disabled="testingProvider === conn.provider"
                @click="handleTest(conn.provider)"
              >
                {{
                  testingProvider === conn.provider
                    ? "Testing..."
                    : "Test Connection"
                }}
              </button>
              <button
                :id="`remove-conn-${conn.provider}`"
                class="btn-danger"
                @click="handleRemoveKey(conn.provider)"
              >
                Remove
              </button>
            </template>
            <template v-else>
              <button
                :id="`add-key-${conn.provider}`"
                class="btn-primary"
                @click="
                  activeInputProvider =
                    activeInputProvider === conn.provider ? null : conn.provider
                "
              >
                {{
                  activeInputProvider === conn.provider
                    ? "Cancel"
                    : "Configure Key"
                }}
              </button>
            </template>
          </div>
        </div>

        <!-- Input drawer if configuring key -->
        <div
          v-if="activeInputProvider === conn.provider"
          class="key-input-drawer"
        >
          <label class="input-label"
            >Enter {{ conn.displayName }} API Key</label
          >
          <div class="input-row">
            <input
              v-model="newApiKey"
              type="password"
              class="secret-input"
              placeholder="Paste secret API key..."
              autocomplete="off"
            />
            <button class="btn-primary" @click="handleSaveKey(conn.provider)">
              Save Key
            </button>
          </div>
        </div>

        <!-- Model selector if configured -->
        <div v-if="getSecretHint(conn.provider)" class="model-select-row">
          <label class="model-label">Selected Model:</label>
          <select v-model="conn.selectedModel" class="model-select">
            <option v-for="m in conn.availableModels" :key="m" :value="m">
              {{ m }}
            </option>
          </select>
        </div>

        <!-- Error notification if any -->
        <div v-if="conn.errorMessage" class="error-strip">
          {{ conn.errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 24px;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.section-header p {
  color: var(--text-secondary);
}

.security-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.banner-icon {
  font-size: 1.1rem;
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.provider-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.provider-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.provider-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.provider-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.status-ready {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-not-configured {
  background: rgba(119, 124, 134, 0.15);
  color: var(--text-muted);
}

.provider-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.provider-desc code {
  font-family: var(--font-family-mono);
  color: var(--accent-cyan);
}

.provider-actions {
  display: flex;
  gap: 10px;
}

.btn-primary {
  padding: 8px 16px;
  background: var(--text-primary);
  color: #101114;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: #ffffff;
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
}

.btn-danger {
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: var(--accent-danger);
  font-size: 0.85rem;
}

.key-input-drawer {
  padding: 16px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.input-row {
  display: flex;
  gap: 10px;
}

.secret-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 0.85rem;
}

.model-select-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.model-label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.model-select {
  padding: 6px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 0.85rem;
}

.error-strip {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-danger);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}
</style>
