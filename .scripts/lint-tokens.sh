#!/usr/bin/env bash
# Design system gate — staged files only.
# Runs in pre-commit hook. Checks only files in the current staging set.
# For full-tree audit, use: bash .scripts/lint-tokens-full.sh

set -e
ERRORS=0

# Get staged CSS files (excluding tokens.css — it's the SoT, primitives allowed)
STAGED_CSS=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep '\.css$' \
  | grep -v '^css/tokens\.css$' || true)

# Get staged HTML files
STAGED_HTML=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep '\.html$' || true)

# Get staged JS files: Chart.js consumers (app.js) and ui/services modules
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACMR \
  | grep -E '^js/(ui|services)/|^js/app\.js$' || true)

# Iterate files safely — handles filenames with spaces.
# Outputs "filename:linenum:content" (grep -H forces filename prefix).
_grep_files() {
  local files="$1"
  shift
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    grep -H "$@" -- "$file" 2>/dev/null || true
  done <<< "$files"
}

# Fix 2: early-exit when nothing relevant is staged
if [ -z "$STAGED_CSS" ] && [ -z "$STAGED_HTML" ] && [ -z "$STAGED_JS" ]; then
  echo "ℹ️  No CSS/HTML/JS files staged. No design system checks needed."
  exit 0
fi

echo "🔍 Checking design system contracts (staged files only)..."

# Rule 1: Hex literal in staged CSS (excluding tokens.css)
if [ -n "$STAGED_CSS" ]; then
  HEXCHECK=$(_grep_files "$STAGED_CSS" -n -E '#[0-9a-fA-F]{3,8}' \
    | grep -Ev ':[0-9]+:[[:blank:]]*/[/*]' || true)
  if [ -n "$HEXCHECK" ]; then
    echo "❌ Hex literal in staged CSS (use semantic tokens from tokens.css):"
    echo "$HEXCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 2: transition: all in staged CSS
if [ -n "$STAGED_CSS" ]; then
  TRANSCHECK=$(_grep_files "$STAGED_CSS" -n -E 'transition:[[:space:]]*all' || true)
  if [ -n "$TRANSCHECK" ]; then
    echo "❌ transition: all — specify properties explicitly:"
    echo "$TRANSCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 3: backdrop-filter without /* glass-exception: */ in staged CSS
if [ -n "$STAGED_CSS" ]; then
  BDCHECK=$(_grep_files "$STAGED_CSS" -n 'backdrop-filter' \
    | grep -v '/\* glass-exception:' || true)
  if [ -n "$BDCHECK" ]; then
    echo "❌ backdrop-filter without '/* glass-exception: <reason> */' on same line:"
    echo "$BDCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 4: filter: url( in staged CSS
if [ -n "$STAGED_CSS" ]; then
  FILTERCHECK=$(_grep_files "$STAGED_CSS" -n -E 'filter:[[:space:]]*url\(' || true)
  if [ -n "$FILTERCHECK" ]; then
    echo "❌ filter: url() — SVG distortion filters are prohibited:"
    echo "$FILTERCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 5: Inline color style in staged HTML
# Scope: color properties only (background-color, color, border-color, etc.)
# Structural inline styles (display, padding, etc.) are tracked separately — not in scope here.
if [ -n "$STAGED_HTML" ]; then
  INLINECHECK=$(_grep_files "$STAGED_HTML" -n -E 'style="[^"]*color[[:space:]]*:' || true)
  if [ -n "$INLINECHECK" ]; then
    echo "❌ Inline color in HTML — move to CSS class:"
    echo "$INLINECHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 6: Primitive color literals in staged JS (app.js, js/ui/, js/services/)
# Any JS that builds Chart.js datasets/options must use chartTokens or readToken().
if [ -n "$STAGED_JS" ]; then
  JSCOLORCHECK=$(_grep_files "$STAGED_JS" -n -E "rgba?\([[:space:]]*[0-9]|#[0-9a-fA-F]{3,8}" \
    | grep -Ev ':[0-9]+:[[:blank:]]*//' || true)
  if [ -n "$JSCOLORCHECK" ]; then
    echo "❌ Primitive color literal in staged JS — use chartTokens or readToken():"
    echo "$JSCOLORCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS contract violation(s) in staged files. Commit blocked."
  echo "   For full backlog audit: bash .scripts/lint-tokens-full.sh"
  exit 1
fi

echo "✅ All design system contracts pass (staged files)."
