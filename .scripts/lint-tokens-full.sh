#!/usr/bin/env bash
# Design system full-tree audit.
# For manual use and CI baseline tracking. NOT used in pre-commit hook.
# Pre-commit gate (staged-only): bash .scripts/lint-tokens.sh

set -e
ERRORS=0

echo "🔍 Full-tree design system audit..."
echo ""

# Rule 1: Hex literal anywhere in css/ (excluding tokens.css)
HEXCHECK=$(grep -rn -E '#[0-9a-fA-F]{3,8}' css/ --include="*.css" \
  | grep -v '^css/tokens\.css:' \
  | grep -Ev ':[0-9]+:[[:blank:]]*/[/*]' || true)
if [ -n "$HEXCHECK" ]; then
  echo "❌ Hex literals outside tokens.css (migration backlog):"
  echo "$HEXCHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# Rule 2: transition: all
TRANSCHECK=$(grep -rn -E 'transition:[[:space:]]*all' css/ --include="*.css" || true)
if [ -n "$TRANSCHECK" ]; then
  echo "❌ transition: all:"
  echo "$TRANSCHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# Rule 3: backdrop-filter without glass-exception
BDCHECK=$(grep -rn 'backdrop-filter' css/ --include="*.css" \
  | grep -v '/\* glass-exception:' || true)
if [ -n "$BDCHECK" ]; then
  echo "❌ backdrop-filter without glass-exception:"
  echo "$BDCHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# Rule 4: filter: url(
FILTERCHECK=$(grep -rn -E 'filter:[[:space:]]*url\(' css/ --include="*.css" || true)
if [ -n "$FILTERCHECK" ]; then
  echo "❌ filter: url():"
  echo "$FILTERCHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# Rule 5: Inline color in HTML
INLINECHECK=$(grep -rn -E 'style="[^"]*color[[:space:]]*:' index.html || true)
if [ -n "$INLINECHECK" ]; then
  echo "❌ Inline color in HTML:"
  echo "$INLINECHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# Rule 6: Primitive color literals in js/ui/ and js/services/
JSCOLORCHECK=$(grep -rn -E "rgba?\([[:space:]]*[0-9]|#[0-9a-fA-F]{3,8}" \
  js/ui/ js/services/ 2>/dev/null \
  | grep -Ev ':[0-9]+:[[:blank:]]*//' || true)
if [ -n "$JSCOLORCHECK" ]; then
  echo "❌ Primitive color literals in js/ui/ or js/services/ (migration backlog):"
  echo "$JSCOLORCHECK"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS rule(s) with violations (full-tree backlog)."
  echo "   These are migration-by-touch items — fix when files are edited."
  exit 1
fi
echo "✅ Full-tree audit clean."
