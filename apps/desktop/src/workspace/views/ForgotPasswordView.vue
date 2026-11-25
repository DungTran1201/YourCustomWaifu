<script setup lang="ts">
import { ref, inject } from "vue";
import { useAppStore } from "@vrm/app-core";
import { AUTH_ENVIRONMENT_KEY } from "../auth/auth-environment-context.js";

const store = useAppStore();
const authEnv = inject(AUTH_ENVIRONMENT_KEY, null);

const email = ref("");
const isSubmitting = ref(false);
const submitted = ref(false);
const responseMessage = ref("");
const formError = ref<string | null>(null);

async function handleSubmit() {
  if (!email.value.trim()) {
    formError.value = "Please enter your email address";
    return;
  }
  formError.value = null;
  isSubmitting.value = true;
  authEnv?.notifySubmitting(true);
  try {
    const msg = await store.forgotPassword(email.value.trim());
    responseMessage.value = msg;
    submitted.value = true;
  } catch (err: any) {
    formError.value = err?.message || "Failed to submit request";
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
        <h1 class="noir-auth-title">Reset Password</h1>
      </div>

      <div v-if="submitted" class="alert alert-success" role="status">
        <div class="alert-title">Reset Requested</div>
        <div>{{ responseMessage }}</div>
      </div>

      <div v-if="formError" class="alert alert-error" role="alert">
        {{ formError }}
      </div>

      <form
        v-if="!submitted"
        class="auth-form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="form-group">
          <label for="reset-email" class="form-label">Email</label>
          <div class="input-wrapper">
            <input
              id="reset-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="form-input"
              placeholder="name@example.com"
              :disabled="isSubmitting"
              @focus="authEnv?.notifyInputFocus()"
              @blur="authEnv?.notifyInputBlur()"
              @input="authEnv?.notifyUserTyping()"
            />
          </div>
        </div>

        <button
          id="forgot-submit-btn"
          type="submit"
          class="btn btn-primary"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting" class="spinner"></span>
          <span>{{ isSubmitting ? "Sending..." : "Send Reset Link" }}</span>
        </button>
      </form>

      <div class="auth-footer">
        <button
          id="back-to-signin-btn"
          type="button"
          class="link-btn font-semibold"
          @click="store.setTab('signin')"
        >
          &larr; Back to sign in
        </button>
        <span class="text-muted">&bull;</span>
        <button
          id="goto-reset-token-btn"
          type="button"
          class="link-btn"
          @click="store.setTab('reset-password')"
        >
          Enter reset token
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="../auth/auth-panel.css"></style>
