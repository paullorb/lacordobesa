#!/usr/bin/env bash
# Vercel's Ignored Build Step (vercel.json `ignoreCommand`): exit 0 skips the
# build, anything else builds. It lives here because Vercel rejects an
# `ignoreCommand` longer than 256 characters, and rejects it by failing the
# deployment before the build starts, with no build log.
#
# Skips anything that is not production, and a production commit that changes
# nothing served. With no previous deployment to compare against, or a `git
# diff` that cannot see it, it builds.

if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then exit 1; fi

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude).github' \
  ':(exclude).claude' \
  ':(exclude)scripts' \
  ':(exclude)supabase' \
  ':(exclude)tests' \
  ':(exclude).oxlintrc.json' \
  ':(exclude,glob)*.md'
