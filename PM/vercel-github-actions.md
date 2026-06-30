# Popup Hub — Vercel production deploy via GitHub Actions

Use this when shipping from **Cursor mobile**, GitHub mobile, or any machine without the Vercel CLI logged in.

`vercel.json` keeps **git deploys disabled** on `master` so Vercel’s Git integration does not create a second production build. **Deploy to Vercel Production** (`.github/workflows/vercel-production.yml`) is the automated path instead of `PM\Deploy-popuphub.bat`.

## Triggers

| Trigger | When |
|---------|------|
| **CI success on `master`** | After the CI workflow passes on a push to `master`, production deploy runs automatically. |
| **Manual (`workflow_dispatch`)** | GitHub → **Actions** → **Deploy to Vercel Production** → **Run workflow**. Optional: skip the build-info smoke check. |

TestFlight still deploys separately via **Deploy to TestFlight** on every `master` push.

## One-time setup — GitHub secrets

Create a Vercel token and link IDs, then add three repository secrets  
(**Settings → Secrets and variables → Actions**):

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create token (scope: deploy). |
| `VERCEL_ORG_ID` | Vercel dashboard → your team/personal **Settings** → General → **Team ID** (or User ID for hobby). |
| `VERCEL_PROJECT_ID` | Project **Settings** → General → **Project ID**. |

On a machine with the project linked (`vercel link`), IDs are also in `.vercel/project.json`:

```json
{
  "orgId": "team_…",
  "projectId": "prj_…"
}
```

Do **not** commit `.vercel/` or tokens to the repo.

## Smoke test after deploy

The workflow polls `https://popuphub.ca/api/build-info` until the `commit` field matches the deployed SHA (up to ~10 minutes).

Manual checks:

```bash
curl -s https://popuphub.ca/api/build-info | jq
curl -sI https://popuphub.ca | head
```

## Local deploy (still supported)

From a machine with Vercel CLI authenticated:

```powershell
PM\Deploy-popuphub.bat -SkipCommit
# or
npx vercel deploy --prod --yes
```

Local scripts still bump semver and refresh session handoff; GitHub Actions deploys whatever is already on `master`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Workflow skipped / secrets error | Add all three secrets above; re-run workflow. |
| Deploy succeeds but build-info stale | Vercel alias propagation — wait 2–5 min or check Vercel → Deployments → Promote. |
| Two production builds per commit | Confirm `vercel.json` still has `git.deploymentEnabled.master: false`. |
| CI passed but no deploy | Open **Actions** → **Deploy to Vercel Production**; confirm `workflow_run` fired after CI. |
