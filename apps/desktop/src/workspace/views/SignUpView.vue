<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useAppStore } from "@vrm/app-core";
import { PASSWORD_POLICY } from "@vrm/shared";
import AppIcon from "../../components/AppIcon.vue";
import { AUTH_ENVIRONMENT_KEY } from "../auth/auth-environment-context.js";

const store = useAppStore();
const authEnv = inject(AUTH_ENVIRONMENT_KEY, null);

const email = ref("");
const displayName = ref("");
const password = ref("");
const showPassword = ref(false);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const isPasswordLongEnough = computed(
  () =>
    password.value.length >= PASSWORD_POLICY.minLength &&
    password.value.length <= PASSWORD_POLICY.maxLength,
);

function handleInput() {
  if (formError.value) {
    formError.value = null;
  }
  authEnv?.notifyUserTyping();
}

async function handleSubmit() {
  const trimmedEmail = email.value.trim();
  if (!trimmedEmail || !password.value) {
    formError.value = "Please complete all required fields";
    return;
  }
  if (password.value.length < PASSWORD_POLICY.minLength) {
    formError.value = `Password must be at least ${PASSWORD_POLICY.minLength} characters long`;
    return;
  }
  if (password.value.length > PASSWORD_POLICY.maxLength) {
    formError.value = `Password must not exceed ${PASSWORD_POLICY.maxLength} characters`;
    return;
  }

  formError.value = null;
  isSubmitting.value = true;
  authEnv?.notifySubmitting(true);
  try {
    await store.register(
      trimmedEmail,
      password.value,
      displayName.value.trim() || undefined,
    );
  } catch (err: any) {
    formError.value = err?.message || "Registration failed";
  } finally {
    isSubmitting.value = false;
    authEnv?.notifySubmitting(false);
  }
}
</script>

<template>
  <div
    class="noir-auth-view"
    :class="authEnv?.isEmbeddedIn3DStage ? 'embedded-3d' : 'standalone-noir'"
  >
    <div class="noir-auth-card">
      <!-- Foreground Mode Switcher -->
      <div
        class="noir-mode-tabs"
        role="tablist"
        aria-label="Authentication Mode"
      >
        <button
          id="auth-tab-signin"
          type="button"
          role="tab"
          aria-selected="false"
          class="noir-mode-tab"
          @click="store.setTab('signin')"
        >
          Sign In
        </button>
        <button
          id="auth-tab-signup"
          type="button"
          role="tab"
          aria-selected="true"
          class="noir-mode-tab active"
          @click="store.setTab('signup')"
        >
          Register
        </button>
      </div>

      <div class="noir-auth-header">
        <h1 class="noir-auth-title">Create Account</h1>
      </div>

      <div
        v-if="formError || store.state.authError"
        class="alert alert-error"
        role="alert"
      >
        {{ formError || store.state.authError }}
      </div>

      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="signup-email" class="form-label">Email</label>
          <div class="input-wrapper">
            <input
              id="signup-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="form-input"
              placeholder="name@example.com"
              :disabled="isSubmitting"
              @focus="authEnv?.notifyInputFocus()"
              @blur="authEnv?.notifyInputBlur()"
              @input="handleInput"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="signup-name" class="form-label">Display Name</label>
          <div class="input-wrapper">
            <input
              id="signup-name"
              v-model="displayName"
              type="text"
              autocomplete="name"
              class="form-input"
              placeholder="Optional"
              :disabled="isSubmitting"
              @focus="authEnv?.notifyInputFocus()"
              @blur="authEnv?.notifyInputBlur()"
              @input="handleInput"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="signup-password" class="form-label">Password</label>
          <div class="input-wrapper">
            <input
              id="signup-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              :minlength="PASSWORD_POLICY.minLength"
              :maxlength="PASSWORD_POLICY.maxLength"
              class="form-input has-trailing-btn"
              placeholder="At least 8 characters"
              :disabled="isSubmitting"
              @focus="authEnv?.notifyInputFocus()"
              @blur="authEnv?.notifyInputBlur()"
              @input="handleInput"
            />
            <button
              type="button"
              class="pwd-toggle-btn"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :title="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <AppIcon :name="showPassword ? 'close' : 'eye'" size="15" />
            </button>
          </div>
          <div class="input-hint" :class="{ valid: isPasswordLongEnough }">
            Min {{ PASSWORD_POLICY.minLength }} characters
          </div>
        </div>

        <button
          id="signup-submit-btn"
          type="submit"
          class="btn btn-primary"
          :disabled="isSubmitting || !isPasswordLongEnough"
        >
          <span v-if="isSubmitting" class="spinner"></span>
          <span>{{ isSubmitting ? "Creating..." : "Create Account" }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped src="../auth/auth-panel.css"></style>
