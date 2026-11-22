#!/bin/sh
# PreToolUse (Bash): refuses a `git push` to a branch whose pull request has
# already merged. Auto-merge squashes and GitHub then deletes the branch; a
# commit pushed in the minutes after that lands on a branch no pull request
# points at any more. Nobody reviews it, nothing merges it, and the sweep can
# only keep it, which is why its log said "pushed to after PR #79 merged" in
# six repos at once on 2026-10-08: one session's follow-up to the shared hooks,
# orphaned six times over. Cut a new branch off origin/main instead.
# Shared across paullorb repos; every failure is silence (exit 0).
payload=$(cat 2>/dev/null) || exit 0
# The parser prints one `<dir>\t<branch>` line per branch a push in the command
# targets, and nothing when the command pushes nothing. A push is `git push`
# (or `git-push`) as a command word: at the start, or after `&&`, `||`, `;`,
# `|`, `&`, `(` or a newline, with any of git's global options between `git`
# and `push` (`git -C ../x -c k=v --no-pager push`). The words inside a commit
# message, an echo or a grep pattern are not one.
#
# The directory is the one the push runs in: `-C <dir>` (relative to what
# precedes it), else the last `cd <dir>` earlier in the same command, else the
# payload's cwd. `--git-dir`/`--work-tree` are passed on to the git that reads
# the current branch. The branch is the remote side of each refspec given
# (`HEAD:feature`, `local:remote`, `feature`), `HEAD` and no refspec at all
# meaning the current branch; a deletion (`:x`, `--delete`) is not checked.
targets=$(printf '%s' "$payload" | python3 -I -c '
import json, os, re, shlex, subprocess, sys

try:
    data = json.load(sys.stdin)
    command = data.get("tool_input", {}).get("command", "") or ""
    cwd = data.get("cwd", "") or ""
except Exception:
    sys.exit(0)
if not cwd or not os.path.isdir(cwd):
    sys.exit(0)

SEPARATORS = {"&&", "||", ";", "|", "&", "(", ")", "\n", ";;", "|&"}
# Global options that take their value as the next word.
VALUED = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env",
          "--super-prefix", "--exec-path"}
PUSH_VALUED = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
KEYWORDS = {"if", "then", "elif", "else", "while", "until", "do", "{", "!", "time"}
EXPANSION = re.compile(r"\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))")
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def tokens(text):
    lexer = shlex.shlex(text, posix=True, punctuation_chars="();<>|&\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""
    return list(lexer)


def segments(words):
    current, skip = [], False
    for word in words:
        if skip:
            skip = False
            continue
        if re.fullmatch(r"[<>&]+", word) and set(word) & set("<>"):
            # A redirection: drop it, its target and a file descriptor before it.
            if current and current[-1].isdigit():
                current.pop()
            skip = True
            continue
        if word in SEPARATORS or set(word) <= set("();|&\n"):
            if current:
                yield current
            current = []
            # Parentheses open and close a subshell: the caller restores the
            # directory at its end.
            for char in word:
                if char in "()":
                    yield char
        else:
            current.append(word)
    if current:
        yield current


def strip_prefixes(segment):
    """Drop what runs a command without being it: `VAR=x`, `command`, `builtin`,
    `exec`, `env` (with its options and assignments) and the shell keywords
    that open a command list (`then`, `do`, `{`, `!`)."""
    while segment:
        word = segment[0]
        if word in KEYWORDS or ASSIGNMENT.match(word) or word in ("command", "builtin", "exec", "nohup"):
            segment = segment[1:]
        elif word == "env":
            segment = segment[1:]
            while segment and (segment[0].startswith("-") or ASSIGNMENT.match(segment[0])):
                # -u and -C take the next word as their value.
                segment = segment[2:] if segment[0] in ("-u", "-C", "--unset", "--chdir") else segment[1:]
        else:
            break
    return segment


def unexpanded(text):
    return "$" in text or "`" in text


def expand(text, here, variables):
    """`$NAME` and `${NAME}` from the command itself, then the environment. What
    is not known (a command substitution, an unset name) stays as written."""
    def value(match):
        name = match.group(1) or match.group(2)
        if name == "PWD":
            return here
        found = variables.get(name, os.environ.get(name))
        return match.group(0) if found is None else found
    return EXPANSION.sub(value, text)


def resolve(base, path):
    # A directory only the shell can name is taken to be the one it stands in:
    # asking about that branch is better than not asking at all.
    if unexpanded(path):
        return base
    return os.path.normpath(os.path.join(base, os.path.expanduser(path)))


def current_branch(directory, git_opts):
    try:
        out = subprocess.run(["git", *git_opts, "branch", "--show-current"],
                             cwd=directory, capture_output=True, text=True, timeout=5)
    except Exception:
        return ""
    return out.stdout.strip() if out.returncode == 0 else ""


def push_targets(directory, git_opts, args):
    """The remote branches this push writes to."""
    positional, deleting, i = [], False, 0
    while i < len(args):
        arg = args[i]
        if arg in ("-d", "--delete"):
            deleting = True
        elif arg in PUSH_VALUED:
            i += 1
        elif arg == "--":
            positional.extend(args[i + 1:])
            break
        elif not arg.startswith("-"):
            positional.append(arg)
        i += 1
    if deleting:
        return []
    refspecs = positional[1:]
    if not refspecs:
        branch = current_branch(directory, git_opts)
        return [branch] if branch else []
    branches = []
    for spec in refspecs:
        spec = spec.lstrip("+")
        if ":" in spec:
            source, _, target = spec.partition(":")
            if not source:
                continue  # `:x` deletes x
        else:
            source = target = spec
        if target == "HEAD" or (source == "HEAD" and not target):
            target = current_branch(directory, git_opts)
        if unexpanded(target):
            # Only the shell knows the name; the current branch is the likely one.
            target = current_branch(directory, git_opts)
        if target.startswith("refs/heads/"):
            target = target[len("refs/heads/"):]
        elif target.startswith("refs/"):
            continue  # tags and other refs have no pull request
        if target:
            branches.append(target)
    return branches


try:
    words = tokens(command)
except ValueError:
    # Unbalanced quoting (a heredoc with an apostrophe): fall back to spotting
    # a plain push and asking about the cwd branch.
    if re.search(r"(?:^|&&|\|\||;|\||\(|\n)\s*(?:(?:env|command)\s+|[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git(?:\s+push|-push)(?:\s|$|;|&|\||\))", command):
        branch = current_branch(cwd, [])
        if branch:
            print(cwd + "\t" + branch)
    sys.exit(0)

here = cwd
variables = {}
scopes = []
for segment in segments(words):
    # A `cd` inside `( ... )` ends with the subshell; the shell that runs the
    # next push is still where it was.
    if segment == "(":
        scopes.append(here)
        continue
    if segment == ")":
        here = scopes.pop() if scopes else here
        continue
    words_only = [w for w in segment if w not in KEYWORDS]
    if words_only and words_only[0] in ("export", "local", "declare", "readonly"):
        words_only = words_only[1:]
    if words_only and all(ASSIGNMENT.match(w) for w in words_only):
        for word in words_only:
            name, _, value = word.partition("=")
            variables[name] = expand(value, here, variables)
        continue
    segment = [expand(w, here, variables) for w in strip_prefixes(segment)]
    if not segment:
        continue
    if segment[0] == "cd":
        rest = [w for w in segment[1:] if w not in ("-L", "-P", "--")]
        here = resolve(here, rest[0]) if rest else os.path.expanduser("~")
        continue
    if segment[0] == "git-push":
        directory, git_opts, args = here, [], segment[1:]
    elif segment[0] == "git":
        directory, git_opts, i = here, [], 1
        while i < len(segment) and segment[i].startswith("-"):
            option = segment[i]
            if option == "-C" and i + 1 < len(segment):
                directory = resolve(directory, segment[i + 1])
                i += 2
                continue
            if option in VALUED and i + 1 < len(segment):
                if option in ("--git-dir", "--work-tree"):
                    git_opts += [option, resolve(directory, segment[i + 1])]
                i += 2
                continue
            name, eq, value = option.partition("=")
            if eq and name in ("--git-dir", "--work-tree"):
                git_opts += [name, resolve(directory, value)]
            i += 1
        if i >= len(segment) or segment[i] != "push":
            continue
        args = segment[i + 1:]
    else:
        continue
    if not os.path.isdir(directory):
        continue
    if git_opts:
        # `gh` finds the repo from its directory, so it runs in the checkout
        # --git-dir/--work-tree name rather than in the one the push starts in.
        try:
            top = subprocess.run(["git", *git_opts, "rev-parse", "--show-toplevel"],
                                 cwd=directory, capture_output=True, text=True, timeout=5)
            gitdir = subprocess.run(["git", *git_opts, "rev-parse", "--absolute-git-dir"],
                                    cwd=directory, capture_output=True, text=True, timeout=5)
        except Exception:
            continue
        # With --git-dir alone git takes the current directory as the work
        # tree, so only the git dir itself names the right repo.
        if "--work-tree" in git_opts:
            found = top.stdout.strip() or gitdir.stdout.strip()
        else:
            found = gitdir.stdout.strip()
        if not found or not os.path.isdir(found):
            continue
        directory = found
    for branch in push_targets(directory, git_opts, args):
        print(directory + "\t" + branch)
' 2>/dev/null) || exit 0
[ -n "$targets" ] || exit 0
command -v gh >/dev/null 2>&1 || exit 0
tab=$(printf '\t')
printf '%s\n' "$targets" | while IFS="$tab" read -r dir branch; do
  [ -n "$dir" ] && [ -n "$branch" ] || continue
  # `gh` resolves the repo from the directory it runs in, so every question
  # about this push is asked where the push runs.
  ( cd "$dir" 2>/dev/null || exit 0
    base=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
    [ "$branch" = "${base:-main}" ] && exit 0
    # An open pull request is the whole point of pushing, so it is asked first
    # and it answers for the common case. Anything gh cannot answer is silence.
    open=$(gh pr list --head "$branch" --state open --limit 1 --json number -q 'length' 2>/dev/null) || exit 0
    [ "$open" = "0" ] || exit 0
    merged=$(gh pr list --head "$branch" --state merged --limit 1 --json number -q '.[0].number' 2>/dev/null) || exit 0
    [ -n "$merged" ] || exit 0
    printf '%s\t%s' "$merged" "$branch" | python3 -I -c '
import json, sys
n, branch = sys.stdin.read().strip().split("\t", 1)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "PR #" + n + " for branch " + branch + " has already merged and no PR is open on it, so a push there lands where nothing will review or merge it. Cut a new branch off origin/main: git worktree add .claude/worktrees/<name> -b <branch> origin/main"}}))'
  )
done | head -n 1
exit 0
