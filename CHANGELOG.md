# Changelog

All notable changes to this project will be documented in this file.

## [1.9.0] - 2026-03-28

### Added
- ChatGPT **modern DOM** support: turns via `data-message-author-role`, optional `[data-message-content]` parts with `####` subsection headings, legacy `article[data-turn]` and `[data-testid^="conversation-turn"]` fallbacks.
- **Source URL** (`sourceUrl`) in export metadata: Markdown header and DOCX title block include **Forrás:** (conversation URL) when available.
- **`fetchBlobWithCredentials`** in the content script for same-origin ChatGPT image URLs (session cookies), with explicit CORS options and opaque-response guard.
- **`__exportTabId`** plumbing so DOCX image downloads run in the tab that holds the session.
- **`chatgptImageSearchRoot`**: searches for generated images under the whole **conversation turn** (or nearest ancestor with `imagegen-image` / estuary `img`), not only inside the role bubble — fixes missing DALL·E / imagegen blocks.
- Image helpers: estuary URL dedupe by `id=` query param, representative pick for `imagegen-image` stacks (blur/sharp duplicates), `domToMarkdown` emits one image per imagegen group.

### Changed
- **Markdown**: image references stay as plain `![alt](url)` only (no base64 inlining).
- **DOCX**: embeds images with resize (max width 500px); ChatGPT `backend-api/estuary/content` URLs fetched with credentials via the active tab.
- Role labels: **Rendszer** / **Eszköz** for `system` / `tool`; optional raw role in headings for non-user/assistant.

### Fixed
- Generated ChatGPT images not appearing in exports (DOM scope + duplicate `<img>` layers).
- Background `fetch` without cookies failing on signed estuary URLs (DOCX placeholders).

## [1.8.6] - 2026-02-13
### Added
- Grok.com image export support.
- Permissions to fetch images from `assets.grok.com`.
- Update checker to notify about new versions.

### Fixed
- CORS issues when downloading generated images from Grok.

## [1.8.5] - Previous Release
- Mermaid workflow diagram support.
- DOCX export improvements.
- Support for ChatGPT, Gemini, and Claude.
