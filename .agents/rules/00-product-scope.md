# Rule: Product scope

## Must
- Treat YourCustomWaifu as a personal AI companion, not an IDE or project-management product.
- Keep Workspace and Avatar Stage as the two primary desktop surfaces.
- Keep Chatspace clean and text-focused; avatar previews belong in Avatar Settings/Stage, never in the chat timeline.
- Preserve supported registration, login, logout and account management.
- Keep capabilities discoverable without turning the interface into a statistics dashboard.

## Must not add without explicit approval
- Project-management screens, Git UI, integrated terminal/editor, local CLI integrations, code-task orchestration or project chat contexts.
- Character/anime banners or portraits inside Chatspace.
- New AI provider, memory, voice, or tool capabilities that are only simulated but presented as functional.

## When scope is ambiguous
Inspect existing code and docs, identify the user outcome, and ask only if a decision materially changes data, security or architecture. Otherwise choose the smallest reversible solution and document the assumption.
