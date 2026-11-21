#!/bin/sh
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit): refuses an edit or a new file
# in the PRIMARY checkout, whatever branch it is on. That checkout is shared by
# every session on this machine; work left there is the next session's
# surprise. A worktree is the answer. Shared across paullorb repos; every
# failure is silence (exit 0).
#
# Decided by the TARGET path, not by where the session runs: a session rooted
# in a worktree can still name the primary checkout by absolute path. The
# primary checkout is the one whose .git directory every worktree of the
# project shares (git's common dir), found from the project directory.
file=$(python3 -I -c '
import json, os, sys
try:
    p = json.load(sys.stdin)
    t = p.get("tool_input", {}) or {}
    f = t.get("file_path") or t.get("notebook_path") or ""
    print(os.path.realpath(os.path.join(p.get("cwd") or os.getcwd(), f)) if f else "")
except Exception:
    print("")' 2>/dev/null) || exit 0
[ -n "$file" ] || exit 0
common=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
# A bare repo, or anything but a checkout's own .git, has no primary checkout.
[ "$(basename "$common")" = ".git" ] && [ -d "$common" ] || exit 0
root=$(cd "$(dirname "$common")" 2>/dev/null && pwd -P) || exit 0
case "$file" in
  "$root"/.claude/worktrees/*) exit 0 ;;   # a worktree that lives under the checkout
  "$root"/*) ;;
  *) exit 0 ;;
esac
# Ignored paths (.env.local, local artifacts) are nobody's surprise; everything
# else, tracked or new, would land in the shared tree.
git -C "$root" check-ignore -q -- "$file" 2>/dev/null && exit 0
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"This is the primary checkout, shared by every session on this machine. Work in a worktree: git worktree add .claude/worktrees/<name> -b <branch> origin/main"}}'
exit 0
