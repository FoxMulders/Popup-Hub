# QA review staging

All new, modified, or generated code from agent sessions is copied here **before** reviewers approve merge to `master`.

## Workflow

1. Session deliverables land under a dated or feature-named subfolder (e.g. `coordinator-site-recovery/`).
2. Each file uses the `_qa` suffix before the extension (e.g. `spatial-layout-editor_qa.tsx`).
3. Reviewers diff staged `_qa` files against production paths listed in each folder's `MANIFEST.md`.
4. After approval, changes are applied (or cherry-picked) on the main development branch — not by editing files in this folder directly.

## Do not

- Treat `qa_review/` as the runtime source of truth.
- Deploy from this directory without promoting approved copies to their canonical paths.
