---
name: vue-best-practices
description: Vue 3 Composition API and TypeScript. Use for tasks matching this capability in the YourCustomWaifu desktop app.
---

# Vue 3 implementation workflow

Use for `.vue` components, composables, route views, UI state, forms or component refactors.

## Before coding
1. Confirm installed Vue, TypeScript, router, build tool and lint versions.
2. For Vue 3 Composition API projects, prefer `<script setup lang="ts">` unless established code requires another style.
3. Write a compact component map for non-trivial UI, specifying component responsibilities, props and emitted events.

## Implementation rules
- Keep source state minimal and derive display state with `computed`.
- Use typed props, emits and composables.
- Use `watch`/`watchEffect` for genuine side effects; stop listeners/subscriptions on disposal.
- Keep view/root components as orchestration surfaces, not giant feature containers.
- Use stable keys in `v-for`; do not combine list and conditionals in ways that hide rendering bugs.
- Avoid `v-html` for untrusted content; sanitize or render structured data safely.
- Handle async loading, cancellation/stale response, empty, error and retry states.
- Avoid untyped event payloads and broad global stores for local component state.

## Verification
Run the actual typecheck/lint/unit commands. For asynchronous tests, use framework-supported flush/wait utilities instead of arbitrary sleeps.

## References
External inspiration: Vue community skill repository (early experiment; review it critically) and Vue official documentation. See `.agents/SOURCES-AND-LICENSES.md`.
