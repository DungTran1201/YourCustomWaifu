# Branch Inventory & Consolidation Matrix

- Date: 2026-10-25
- Repository: `https://github.com/DungTran1201/YourCustomWaifu`
- Canonical Target Branch: `main`
- Recovery Bundle Location: `..\YourCustomWaifu-pre-electron-reset.bundle` (Verified SHA1 bundle containing all 7 refs)

## 1. Branch Table

| Branch Name | Scope / Ref | Tip Commit SHA | Date & Author | Unique Commits vs `main` | Unique Functionality | Consolidation Decision | Target Deletion Status |
|---|---|---|---|---|---|---|---|
| `main` (current remote default) | `refs/heads/main`, `origin/main` | `1338d4b49b12ba9e9a19834405b1157dc8ecd419` | 2026-10-25 Dung Tran | 0 (Base branch) | Obsolete scaffold with legacy DiP / ARDY motion generation experiments | **CANONICAL DESTINATION**: Will be fast-forwarded / updated with consolidated desktop platform | **RETAINED** as single active branch |
| `chore/web-electron-foundation-reset` | `refs/heads/chore/web-electron-foundation-reset`, `origin/chore/web-electron-foundation-reset` | `a2f1217060d297982bb24ac504b9b249784b520c` | 2026-10-25 Dung Tran | 9 commits ahead of `1338d4b` (`5d826a0`..`a2f1217`) | Full Electron desktop shell, Two independent windows (Workspace & Avatar Stage), Three.js VRM loader + mannequin, `safeStorage` auth, 15 agent skills, 11 rules, 10 agent profiles | **CONSOLIDATE TO MAIN**: All features are merged into `main` | **SCHEDULED FOR DELETION** after `main` is updated and verified |
| `backup/pre-controlled-restructure` | Local ref `refs/heads/backup/pre-controlled-restructure` | `c46a11aaf0f4a8277de6cc315e06402dfa453679` | 2026-10-25 Dung Tran | Ancestor of `a2f1217` | Local safety checkpoint created before agent pack verification | Preserved in bundle | **SCHEDULED FOR LOCAL REMOVAL** after consolidation |

## 2. GitHub PR & Release State
- Pull Requests: 0 open, 0 closed (Checked via `gh pr list --state all`).
- Releases: 0 releases (Checked via `gh release list`).
- Default Branch on GitHub: `main` (Verified via `gh repo view`).

## 3. Consolidation Strategy
Since `chore/web-electron-foundation-reset` is a direct linear descendant of `main` (commit `a2f1217` has `1338d4b` in its direct ancestry chain), `main` can be safely advanced to include all desktop companion improvements without loss of commit provenance.
Following the removal of website-only artifacts (Phase C), `main` will be updated, validated with full test suites, committed, and pushed. Once remote `main` is confirmed at the identical SHA, `chore/web-electron-foundation-reset` will be deleted from `origin` and local refs.
