# F09 — Local Files and Attachments

## 1. Functional Scope & Purpose
F09 governs local asset import, specifically 3D VRM avatar files, asset path verification, and ArrayBuffer transfers across Electron IPC boundaries to the rendering engine.

## 2. Current Implementation
- **File Dialog:** `main/index.ts:1087` invokes `dialog.showOpenDialog` filtered to `*.vrm`.
- **Buffer Transfer:** `main/index.ts:1131` (`STAGE_LOAD_VRM_BUFFER`) validates file paths against path traversal attacks, reads binary file buffers via `fs.readFile`, and passes them to the renderer as `ArrayBuffer`.
- **Sample Downloader:** `main/sample-vrm.ts` downloads and caches `AvatarSample_B.vrm` locally for first-run or guest mode preview.

## 3. Requirements & Acceptance Criteria
- AC-01: File selection must restrict file dialog extensions to `.vrm`.
- AC-02: Buffer loading must validate file paths and reject non-existent or inaccessible files cleanly.
- AC-03: Binary buffers must be verified and parsed without corrupting active avatar memory.
