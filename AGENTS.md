<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Session handoff

At the end of every scoped task, update `PM/session-handoff.md` (baseline, shipped work, blockers, next actions). After deploys, run `.\scripts\update-session-handoff.ps1` or use `PM/Deploy-popuphub.bat` / `ship.ps1`, which refresh baseline automatically.

## Release workflow

When the user explicitly asks for a commit:

1. Commit only the intended changes (never `.env` or credentials).
2. `git push -u origin HEAD` (or `git push` if upstream is already set).
3. `npx vercel deploy --prod --yes`

Report the commit hash, push result, and production URL (including https://popuphub.ca when aliased).

Do not force-push `main`/`master` or skip git hooks unless the user explicitly requests it. If a commit fails, fix and create a new commit rather than amending unless amend rules apply.
