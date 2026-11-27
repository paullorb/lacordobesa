<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working as an agent here — the same in every paullorb repo

- **Keep the context small.** Hand off to a fresh session once the context
  passes about 200k tokens; never open a 1M-window session for routine work.
  A turn at 500k costs five times a turn at 100k even when it is all cache
  reads (the 2026-10-07 cross-project token audit).
- **Sweep with a subagent, not from the main context.** A `grep`/`sed`/`cat`
  pass over the tree belongs in an Explore subagent that returns the
  conclusion; read a file yourself only when you are about to edit it.
- **Routine work runs on Sonnet.** Red PRs, Dependabot follow-ups, gate
  re-runs and canary triage do not need the most expensive model.
- **Work in a worktree, never the primary checkout**
  (`.claude/hooks/primary-checkout-guard.sh` refuses the edit). The session
  starts by listing the repo's red PRs (`.claude/hooks/red-prs.sh`); your own
  red PR comes before new work. A push to a branch whose PR has already merged
  is refused as well (`.claude/hooks/merged-branch-push-guard.sh`): auto-merge
  squashed it and GitHub deleted the branch, so the commit would land where
  nothing reviews or merges it. Cut a new branch off `origin/main`.
- **Report the verdict, not the mechanics**: "CI passed" is the whole report.
  Wait for an outcome once, do not poll for it.
- **Every change goes through a PR into `main` with auto-merge armed**; never
  merge by hand. `.github/workflows/auto-merge.yml` arms it when the PR opens,
  GitHub deletes the branch on merge, and the nightly sweep removes the local
  branch and its worktree once the work is proven merged.
- **A PR never waits on Paul.** He does not read threads to find a PR that
  is open or asking for his review. If a change needs his decision or his
  review, ask him before opening the PR (in the thread he is in, or as a
  `for-paul` issue) and open it once he has answered. An open PR has two
  ends: it merges by itself on green, or it is closed with the reason in a
  comment. Fix whatever keeps it from merging (red check, conflict, unarmed
  auto-merge, unresolved review thread); if it cannot be fixed, close it.
  Never request his review and never leave a PR open "for review".
- **Open a PR ready, never as a draft.** Finish the local checks first, then
  open it. A draft's first auto-merge run is skipped, and the PR can then sit
  green, armed and "blocked" (paullorb/paullorber#495, paullorb/cicd#128).
  After opening, see that it merged.
- **Hand Paul his tasks as issues, not prose.** When something only Paul can
  do — a secret to set, a LaunchAgent to install, a decision to take — open
  an issue in the repo concerned, label it `for-paul`, and put the exact
  commands or the question in the body. It shows up in the Tasks component on
  status.paullorber.com until he closes it; a sentence at the end of a chat
  thread does not. When it waits on a client instead (their credentials,
  their decision, a record only they hold), label it `for-client`: it shows
  under "Waiting on clients" in the same panel, and stays out of Paul's own
  list.
