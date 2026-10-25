# Rule: Workspace and Avatar Stage lifecycle

- Model Workspace visibility, Stage visibility, app lifecycle, animation pause state, click-through, and runtime activity separately.
- Closing Workspace must not destroy the Stage or shut down the shared Agent Runtime.
- Hiding Stage must not sign out, clear the selected avatar, or terminate runtime work.
- Application Quit must be explicit and must perform orderly shutdown and resource cleanup.
- Ensure a single Stage instance through a window registry; clean references on `closed`.
- Reopening a window must reuse a live window or recreate it safely without duplicate listeners or duplicated windows.
- Persist position/size only after validating restored bounds against current displays/work areas; account for unplugged monitors and changed display scale.
- Register global shortcuts once, handle registration conflicts and unregister on quit.
- Click-through must have a clear path back to interactive mode (tray or global shortcut).
- Test behavior on the target OS; do not assume browser-level tests prove native window behavior.
