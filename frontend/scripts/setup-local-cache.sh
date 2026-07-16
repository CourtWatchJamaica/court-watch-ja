#!/usr/bin/env bash
# Redirects the Next.js .next build cache to a local (non-encrypted-volume)
# directory. Only needed if this repo lives on a VeraCrypt/macFUSE volume,
# where per-file encryption overhead makes `.next`'s constant small writes
# very slow (Next.js will warn "Slow filesystem detected").
#
# Source code stays exactly where it is (on the encrypted volume) — this
# only relocates compiled/cached build output, which is safe to keep local
# and gets regenerated from source on every build anyway.
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="$HOME/.cache/courtwatch-frontend"

mkdir -p "$CACHE_ROOT/.next"

# Turbopack resolves node_modules by walking up from the physical location
# of its cache files, so a node_modules symlink needs to exist alongside
# .next in the cache root too, pointing back at the real one.
ln -sfn "$FRONTEND_DIR/node_modules" "$CACHE_ROOT/node_modules"

if [ -L "$FRONTEND_DIR/.next" ]; then
  echo ".next is already a symlink, leaving it as-is."
elif [ -e "$FRONTEND_DIR/.next" ]; then
  rm -rf "$FRONTEND_DIR/.next"
  ln -s "$CACHE_ROOT/.next" "$FRONTEND_DIR/.next"
  echo "Replaced .next with a symlink to $CACHE_ROOT/.next"
else
  ln -s "$CACHE_ROOT/.next" "$FRONTEND_DIR/.next"
  echo "Created .next symlink to $CACHE_ROOT/.next"
fi
