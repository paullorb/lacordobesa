#!/bin/sh
# SessionStart: which open PRs are red, so a session fixes its own before it
# starts new work. Shared across paullorb repos; every failure is silence.
# Red is gh's "fail" bucket: a check run that FAILED, TIMED_OUT, had a
# STARTUP_FAILURE or needs ACTION, or a status context in FAILURE or ERROR.
# Only PR numbers reach the context: titles and branch names are untrusted text.
command -v gh >/dev/null 2>&1 || exit 0
red=$(gh pr list --state open --limit 30 --json number,statusCheckRollup \
  -q '[.[] | select(any(.statusCheckRollup[]?; (.conclusion // .state) as $s | $s == "FAILURE" or $s == "ERROR" or $s == "TIMED_OUT" or $s == "STARTUP_FAILURE" or $s == "ACTION_REQUIRED")) | "#\(.number)"] | join(", ")' 2>/dev/null) || exit 0
[ -n "$red" ] || exit 0
printf '%s' "$red" | python3 -I -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "Red PRs (failing checks) in this repo: " + sys.stdin.read() + ". Your own red PR comes before new work; read it with gh pr view <number>."}}))'
exit 0
