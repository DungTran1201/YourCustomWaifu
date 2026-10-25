# Upstream references and license notes

This pack contains project-specific original guidance. It does not reproduce upstream skill files verbatim. These repositories are references for further reading or optional upstream skill installation; always inspect current license files and transitive dependencies before copying source content into the repository.

## Electron
- `full-stack-skills/electron-skills`: https://github.com/full-stack-skills/electron-skills — describes Electron and Electron EGG skills; repository advertises Apache-2.0. Prefer the `electron` skill for a normal Electron app, not `electron-egg` unless intentionally using that framework.
- `agents-inc/skills`, `desktop-framework-electron`: https://github.com/agents-inc/skills/tree/main/src/skills/desktop-framework-electron — Electron architecture, IPC, preload security, native APIs and packaging. Verify license and files at the commit you adopt.
- `agents-inc/skills`, `desktop-multiwindow-electron`: https://github.com/agents-inc/skills/tree/main/src/skills/desktop-multiwindow-electron — multi-window lifecycle, state persistence, display bounds and IPC patterns. Verify license and version before copying.
- Official Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Official Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
- Official Electron BrowserWindow: https://www.electronjs.org/docs/latest/api/browser-window
- Official Electron Tray: https://www.electronjs.org/docs/latest/api/tray

## Vue
- `vuejs-ai/skills`: https://github.com/vuejs-ai/skills — community/early-experiment Vue 3 agent skills including Composition API, Pinia and testing. The upstream README warns that skills may be incomplete; review recommendations against the actual project and official Vue docs. Individual `vue-best-practices` declares MIT in its current skill metadata; verify at revision used.
- Vue docs: https://vuejs.org/guide/introduction.html
- Pinia docs: https://pinia.vuejs.org/

## Three.js / VRM
- `full-stack-skills/threejs-skills`: https://github.com/full-stack-skills/threejs-skills — repository advertises Apache-2.0; includes loaders, animation and renderer skills. `threejs-loaders` metadata identifies Apache-2.0; still preserve upstream notices if copying any file.
- Three.js docs: https://threejs.org/docs/
- `pixiv/three-vrm`: https://github.com/pixiv/three-vrm — VRM integration for Three.js; inspect its license and version constraints before adopting.

## UI testing
- Playwright CLI skills: https://github.com/microsoft/playwright.dev/blob/main/agent-cli/skills.mdx — documents optional `.agents/skills` installation with `playwright-cli install --skills=agents`. Verify tool availability before installing.
- Playwright docs: https://playwright.dev/docs/intro

## Agent Skills conventions
- Skills CLI: https://github.com/vercel-labs/skills
- Agent Skills specification: https://agentskills.io/

## Safe adoption policy
1. The project-specific files in this pack are original, not copied upstream skill source.
2. If using the Skills CLI to install upstream skills, record source repo, revision, skill path and license.
3. Do not bulk-copy repositories without checking license and third-party notices.
4. Re-evaluate links and version-sensitive advice when upgrading Electron, Vue, Three.js or `@pixiv/three-vrm`.
