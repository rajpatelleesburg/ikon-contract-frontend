#!/bin/bash

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

if [[ "$VERCEL_GIT_COMMIT_REF" == "main" ]] ; then
  # Proceed with the build for the main branch
  echo "✅ - Build can proceed for the main branch"
  exit 1;
else
  # Don't build for any other branch (e.g., dev)
  echo "🛑 - Build cancelled for $VERCEL_GIT_COMMIT_REF"
  exit 0;
fi