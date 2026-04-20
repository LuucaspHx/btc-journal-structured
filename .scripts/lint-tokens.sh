#!/usr/bin/env bash
# Design system gate — staged files only.
# Checks only LINES BEING ADDED in this commit, not pre-existing violations.
# Pre-existing backlog is tracked by: bash .scripts/lint-tokens-full.sh
# Runs in pre-commit hook.
#
# Enforcement philosophy:
#   "Don't add new hardcodes" — not "clear the whole file on every touch."
#   Migration-by-touch means new code in this commit must use tokens.
#   Legacy violations in untouched lines are backlog items, not blockers.

set -e
ERRORS=0

# Get staged files (including renamed+modified — R flag)
STAGED_CSS=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep '\.css$' \
  | grep -v '^css/tokens\.css$' || true)

STAGED_HTML=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep '\.html$' || true)

# Chart.js consumers: app.js is the dataset/options consumer; ui/ and services/ are modules
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep -E '^js/(ui|services)/|^js/app\.js$' || true)

# Extract only lines being ADDED in this commit for a given file.
# Strips the leading '+' from diff output. Handles filenames with spaces.
# Outputs matching lines prefixed with "filename: " (no line numbers — diff context).
_grep_added() {
  local file="$1"
  shift
  local added
  added=$(git diff --cached -- "$file" | grep '^+[^+]' | sed 's/^+//' || true)
  [ -n "$added" ] && printf '%s\n' "$added" | grep "$@" 2>/dev/null | sed "s|^|${file}: |" || true
}

# Early-exit: nothing relevant staged
if [ -z "$STAGED_CSS" ] && [ -z "$STAGED_HTML" ] && [ -z "$STAGED_JS" ]; then
  echo "ℹ️  No CSS/HTML/JS files staged. No design system checks needed."
  exit 0
fi

echo "🔍 Checking design system contracts (new lines only)..."

# Rule 1: New hex literals in staged CSS (excluding tokens.css)
# Note: comment lines (starting with // or /*) are filtered — inline trailing comments still flagged.
if [ -n "$STAGED_CSS" ]; then
  HEXCHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" -E '#[0-9a-fA-F]{3,8}' \
      | grep -Ev ': *[[:blank:]]*/[/*]' || true)
    HEXCHECK="${HEXCHECK}${result}"
  done <<< "$STAGED_CSS"
  if [ -n "$HEXCHECK" ]; then
    echo "❌ New hex literal in CSS (use semantic tokens from tokens.css):"
    echo "$HEXCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 2: New transition: all in staged CSS
if [ -n "$STAGED_CSS" ]; then
  TRANSCHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" -E 'transition:[[:space:]]*all' || true)
    TRANSCHECK="${TRANSCHECK}${result}"
  done <<< "$STAGED_CSS"
  if [ -n "$TRANSCHECK" ]; then
    echo "❌ transition: all — specify properties explicitly:"
    echo "$TRANSCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 3: New backdrop-filter without /* glass-exception: */ comment in staged CSS
if [ -n "$STAGED_CSS" ]; then
  BDCHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" 'backdrop-filter' \
      | grep -v '/\* glass-exception:' || true)
    BDCHECK="${BDCHECK}${result}"
  done <<< "$STAGED_CSS"
  if [ -n "$BDCHECK" ]; then
    echo "❌ backdrop-filter without '/* glass-exception: <reason> */' on same line:"
    echo "$BDCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 4: New filter: url( in staged CSS
if [ -n "$STAGED_CSS" ]; then
  FILTERCHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" -E 'filter:[[:space:]]*url\(' || true)
    FILTERCHECK="${FILTERCHECK}${result}"
  done <<< "$STAGED_CSS"
  if [ -n "$FILTERCHECK" ]; then
    echo "❌ filter: url() — SVG distortion filters are prohibited:"
    echo "$FILTERCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 5: New inline color style in staged HTML
# Scope: color properties only (background-color, color, border-color, etc.)
# Structural inline styles (display, padding, etc.) are out of scope.
if [ -n "$STAGED_HTML" ]; then
  INLINECHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" -E 'style="[^"]*color[[:space:]]*:' || true)
    INLINECHECK="${INLINECHECK}${result}"
  done <<< "$STAGED_HTML"
  if [ -n "$INLINECHECK" ]; then
    echo "❌ New inline color in HTML — move to CSS class:"
    echo "$INLINECHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 6: New primitive color literals in Chart.js consumer JS (app.js, js/ui/, js/services/)
# Colors must go through chartTokens or readToken() — not inline rgba()/hex.
if [ -n "$STAGED_JS" ]; then
  JSCOLORCHECK=""
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    result=$(_grep_added "$f" -E "rgba?\([[:space:]]*[0-9]|#[0-9a-fA-F]{3,8}" \
      | grep -Ev ': *[[:blank:]]*//' || true)
    JSCOLORCHECK="${JSCOLORCHECK}${result}"
  done <<< "$STAGED_JS"
  if [ -n "$JSCOLORCHECK" ]; then
    echo "❌ New primitive color literal in JS — use chartTokens or readToken():"
    echo "$JSCOLORCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS violation(s) added in this commit. Commit blocked."
  echo "   Pre-existing backlog: bash .scripts/lint-tokens-full.sh"
  exit 1
fi

echo "✅ No new design system violations in this commit."
