# Rule: Vue and TypeScript

- Follow the current project configuration. If Vue 3 Composition API is used, prefer `<script setup lang="ts">` unless an established module intentionally uses another API.
- Enable strict typing consistent with the repository; avoid `any`, unsafe casts and `@ts-ignore` unless explained and localized.
- Define typed props/emits and typed IPC contracts; keep UI components focused.
- Keep derivable data in computed state; watchers should be used for side effects and cleaned up when needed.
- Do not mutate props or duplicate the same state across unrelated stores.
- Split features into views, components, composables and services based on responsibility; avoid giant root components.
- Use stable keys for rendered lists, handle loading/error/empty states and avoid unescaped HTML.
- Run the repository's actual typecheck/lint/tests after changes; do not assume scripts exist.
