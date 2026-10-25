# Optional hooks / safety scripts

Hook formats are specific to each coding-agent host. These files are **not automatically registered**. Only wire a script into a host's hook configuration after reviewing command syntax and permissions.

- `preflight.ps1`: read-only status/branch/manifest summary before a large change.
- `post-change-check.ps1`: runs only common scripts that are actually defined in root `package.json`; adjust for pnpm workspace projects.
- `.agents/scripts/validate_agent_pack.py`: validates pack metadata and required files, not the app.

Do not run destructive repository cleanup from hooks. Hooks should fail clearly, preserve user edits and never print environment secrets.
