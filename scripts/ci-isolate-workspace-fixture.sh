#!/usr/bin/env bash
# Reproduce the vacant /workspace cwd assumed by
# packages/skill/tool-skill/tests/tool-skill.spec.ts without changing that spec.
# The spec calls agentForCwd('/workspace') and expects no project skills.
set -euo pipefail

empty="${RUNNER_TEMP:-/tmp}/dsh-empty-workspace"
mkdir -p "$empty"

if [ ! -e /workspace ]; then
  echo "Creating empty /workspace for vacant-cwd tool-skill tests"
  sudo mkdir -p /workspace
  sudo mount --bind "$empty" /workspace
  exit 0
fi

if [ -n "$(ls -A /workspace 2>/dev/null || true)" ]; then
  echo "Isolating populated /workspace behind an empty bind mount"
  sudo mount --bind "$empty" /workspace
  exit 0
fi

echo "/workspace already exists and is empty"
