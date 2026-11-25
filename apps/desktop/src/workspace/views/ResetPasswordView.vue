<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useAppStore } from "@vrm/app-core";
import { PASSWORD_POLICY } from "@vrm/shared";
import AppIcon from "../../components/AppIcon.vue";
import { AUTH_ENVIRONMENT_KEY } from "../auth/auth-environment-context.js";

const store = useAppStore();
const authEnv = inject(AUTH_ENVIRONMENT_KEY, null);

const token = ref(store.state.resetToken || "");
const newPassword = ref("");
const showPassword = ref(false);
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const isPasswordLongEnough = computed(
  () =>
    newPassword.value.length >= PASSWORD_POLICY.minLength &&
    newPassword.value.length <= PASSWORD_POLICY.maxLength,
);

async function handleSubmit() {
  if (!token.value.trim() || !newPassword.value) {
    formError.value = "Please provide both the reset token and new password";
    return;
  }
  if (newPassword.value.length < PASSWORD_POLICY.minLength) {
    formError.value = `New password must be at least ${PASSWORD_POLICY.minLength} characters long`;
    return;
  }
  if (newPassword.value.length > PASSWORD_POLICY.maxLength) {
    formError.value = `New password must not exceed ${PASSWORD_POLICY.maxLength} characters`;
    return;
  }

  formError.value = null;
  isSubmitting.value = true;
  authEnv?.notifySubmitting(true);
  try {
    await store.resetPassword(token.value.trim(), newPassword.value);
  } catch (err: any) {
    formError.value =
      err?.message || "Password reset failed. The link may have expired.";
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
      <div class="noir-auth-header">
        <h1 class="noir-auth-title">Set New Password</h1>
      </div>

      <div v-if="formError" class="alert alert-error" role="alert">
        {{ formError }}
      </div>

      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="reset-token-input" class="form-label">Reset Token</label>
          <div class="input-wrapper">
            <input
              id="reset-token-input"
              v-model="token"
              type="text"
              required
              class="form-input font-mono"
              placeholder="Paste reset token"
              :disabled="isSubmitting"
              @focus="authEnv?.notifyInputFocus()"
              @blur="authEnv?.notifyInputBlur()"
              @input="authEnv?.notifyUserTyping()"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="reset-new-password" class="form-label"
            >New Password</label
          >
          <div class="input-wrapper">
            <input
              id="reset-new-password"
              v-model="newPassword"
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
              @input="authEnv?.notifyUserTyping()"
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
          id="reset-submit-btn"
          type="submit"
          class="btn btn-primary"
          :disabled="isSubmitting || !isPasswordLongEnough"
        >
          <span v-if="isSubmitting" class="spinner"></span>
          <span>{{ isSubmitting ? "Updating..." : "Update Password" }}</span>
        </button>
      </form>

      <div class="auth-footer">
        <button
          type="button"
          class="link-btn font-semibold"
          @click="store.setTab('signin')"
        >
          &larr; Back to sign in
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="../auth/auth-panel.css"></style>
