#!/usr/bin/env bash
# Design system gate — staged files only.
# Runs in pre-commit hook. Checks only files in the current staging set.
# For full-tree audit, use: bash .scripts/lint-tokens-full.sh

set -e
ERRORS=0

# Get staged CSS files (excluding tokens.css — it's the SoT, primitives allowed)
STAGED_CSS=$(git diff --cached --name-only --diff-filter=ACM \
  | grep '\.css$' \
  | grep -v '^css/tokens\.css$' || true)

# Get staged HTML files
STAGED_HTML=$(git diff --cached --name-only --diff-filter=ACM \
  | grep '\.html$' || true)

# Get staged JS files under js/ui/ and js/services/
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '^js/(ui|services)/' || true)

echo "🔍 Checking design system contracts (staged files only)..."

# Rule 1: Hex literal in staged CSS (excluding tokens.css)
if [ -n "$STAGED_CSS" ]; then
  HEXCHECK=$(echo "$STAGED_CSS" \
    | xargs grep -n -E '#[0-9a-fA-F]{3,8}' 2>/dev/null \
    | grep -Ev ':[0-9]+:[[:blank:]]*/[/*]' || true)
  if [ -n "$HEXCHECK" ]; then
    echo "❌ Hex literal in staged CSS (use semantic tokens from tokens.css):"
    echo "$HEXCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 2: transition: all in staged CSS
if [ -n "$STAGED_CSS" ]; then
  TRANSCHECK=$(echo "$STAGED_CSS" \
    | xargs grep -n -E 'transition:[[:space:]]*all' 2>/dev/null || true)
  if [ -n "$TRANSCHECK" ]; then
    echo "❌ transition: all — specify properties explicitly:"
    echo "$TRANSCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 3: backdrop-filter without /* glass-exception: */ in staged CSS
if [ -n "$STAGED_CSS" ]; then
  BDCHECK=$(echo "$STAGED_CSS" \
    | xargs grep -n 'backdrop-filter' 2>/dev/null \
    | grep -v '/\* glass-exception:' || true)
  if [ -n "$BDCHECK" ]; then
    echo "❌ backdrop-filter without '/* glass-exception: <reason> */' on same line:"
    echo "$BDCHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Rule 4: filter: url( in staged CSS
if [ -n "$STAGED_CSS" ]; then
  FILTERCHECK=$(echo "$STAGED_CSS" \
    | xargs grep -n -E 'filter:[[:space:]]*url\(' 2>/dev/null || true)
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
  INLINECHECK=$(echo "$STAGED_HTML" \
    | xargs grep -n -E 'style="[^"]*color[[:space:]]*:' 2>/dev/null || true)
  if [ -n "$INLINECHECK" ]; then
    echo "❌ Inline color in HTML — move to CSS class:"
    echo "$INLINECHECK"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS contract violation(s) in staged files. Commit blocked."
  echo "   For full backlog audit: bash .scripts/lint-tokens-full.sh"
  exit 1
fi

if [ -z "$STAGED_CSS" ] && [ -z "$STAGED_HTML" ] && [ -z "$STAGED_JS" ]; then
  echo "ℹ️  No CSS/HTML/JS files staged. No design system checks needed."
  exit 0
fi

echo "✅ All design system contracts pass (staged files)."
