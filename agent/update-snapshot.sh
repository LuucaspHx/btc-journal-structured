#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT_FILE="$ROOT_DIR/agent/snapshot.md"

extract_section() {
  start_heading=$1
  end_heading=$2
  awk -v start="$start_heading" -v end="$end_heading" '
    $0 == start { flag=1; print; next }
    $0 == end && flag { exit }
    flag { print }
  ' "$ROOT_DIR/project-brain.md"
}

{
  echo "# Agent Snapshot"
  echo
  echo "Gerado em: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo
  echo "## Workspace"
  echo "- CWD: \`$ROOT_DIR\`"
  echo "- Branch: \`$(git -C "$ROOT_DIR" branch --show-current)\`"
  echo
  echo "## Git Head"
  git -C "$ROOT_DIR" log --oneline -5
  echo
  echo "## JS Inventory"
  find "$ROOT_DIR" -name "*.js" -not -path "*/node_modules/*" | sed "s|$ROOT_DIR/|./|" | sort
  echo
  echo "## Project Brain: Arquitetura Atual"
  extract_section "## Arquitetura atual" "## Fluxo real da aplicacao"
  echo
  echo "## Project Brain: Fluxo Real da Aplicacao"
  extract_section "## Fluxo real da aplicacao" "## Estado persistido"
  echo
  echo "## Project Brain: Processo Oficial"
  extract_section "## Processo oficial" "## Cadencia documental e snapshots"
  echo
  echo "## Project Brain: Proximo Passo Recomendado"
  extract_section "## Proximo passo recomendado" "## Estado atual"
  echo
  echo "## Project Brain: Estado Atual"
  extract_section "## Estado atual" "## Incidente visual encerrado por ora"
  echo
  echo "## Project Brain: Proximo Passo Operacional"
  awk '
    $0 == "## Proximo passo operacional" { flag=1; print; next }
    flag { print }
  ' "$ROOT_DIR/project-brain.md"
} > "$OUT_FILE"

echo "snapshot atualizado em $OUT_FILE"
