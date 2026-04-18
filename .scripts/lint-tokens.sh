#!/usr/bin/env bash
# Design system enforcement — corre antes de cada commit.
# Falha (exit 1) se encontrar violações de contrato.

set -e
ERRORS=0

echo "🔍 Checking design system contracts..."

# 1. Hex literal fora de tokens.css
# grep -rn produz "ficheiro:linha:conteúdo" — exclui tokens.css inteiro
# e linhas cujo conteúdo começa com comentário CSS (/* ou //)
HEXCHECK=$(grep -rn -E '#[0-9a-fA-F]{3,8}' css/ --include="*.css" \
  | grep -v '^css/tokens\.css:' \
  | grep -Ev ':[0-9]+:[[:blank:]]*/[/*]' || true)

if [ -n "$HEXCHECK" ]; then
  echo "❌ Hex literal fora de css/tokens.css:"
  echo "$HEXCHECK"
  ERRORS=$((ERRORS + 1))
fi

# 2. transition: all
TRANSCHECK=$(grep -rn -E 'transition:[[:space:]]*all' css/ --include="*.css" || true)
if [ -n "$TRANSCHECK" ]; then
  echo "❌ transition: all proibido — especificar propriedades:"
  echo "$TRANSCHECK"
  ERRORS=$((ERRORS + 1))
fi

# 3. backdrop-filter sem glass-exception na mesma linha
BDCHECK=$(grep -rn 'backdrop-filter' css/ --include="*.css" \
  | grep -v '/\* glass-exception:' || true)
if [ -n "$BDCHECK" ]; then
  echo "❌ backdrop-filter sem '/* glass-exception: <razão> */' na mesma linha:"
  echo "$BDCHECK"
  ERRORS=$((ERRORS + 1))
fi

# 4. filter: url( — SVG distortion proibido
FILTERCHECK=$(grep -rn -E 'filter:[[:space:]]*url\(' css/ --include="*.css" || true)
if [ -n "$FILTERCHECK" ]; then
  echo "❌ filter: url() proibido (SVG distortion):"
  echo "$FILTERCHECK"
  ERRORS=$((ERRORS + 1))
fi

# 5. Cores inline em HTML
INLINECHECK=$(grep -rn -E 'style="[^"]*color[[:space:]]*:' index.html || true)
if [ -n "$INLINECHECK" ]; then
  echo "❌ Cor inline em HTML — mover para classe CSS:"
  echo "$INLINECHECK"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS contract violation(s). Commit blocked."
  exit 1
fi

echo "✅ All design system contracts pass."
