import { summarizeSecurityState } from '../../security/model.js';

function setText(root, id, value) {
  const el = root?.getElementById?.(id);
  if (el) el.textContent = value == null || value === '' ? '—' : String(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT');
}

function assetDetails(asset) {
  const parts = [];
  if (asset.protocol) parts.push(asset.protocol.toUpperCase());
  if (asset.port) parts.push(`porta ${asset.port}`);
  if (asset.resolved === false) parts.push('não resolvido');
  return parts.join(' · ') || '—';
}

function appendEmptyRow(root, body, message) {
  const row = root.createElement('tr');
  const cell = root.createElement('td');
  cell.colSpan = 4;
  cell.className = 'muted';
  cell.textContent = message;
  row.appendChild(cell);
  body.appendChild(row);
}

export function renderSecurityCenter(state, root = document) {
  const summary = summarizeSecurityState(state);
  setText(root, 'securityTarget', summary.target);
  setText(root, 'securityLastScan', formatDate(summary.lastScan));
  setText(root, 'securityAssetCount', summary.assetsDiscovered);
  setText(root, 'securitySubdomainCount', summary.subdomains);
  setText(root, 'securityServiceCount', summary.publicServices);
  setText(root, 'securityFindingCount', summary.findings);
  setText(root, 'securityNewAssetCount', summary.newAssets == null ? '—' : summary.newAssets);
  setText(root, 'securityRelationCount', summary.relations);
  setText(root, 'securitySource', state?.scan?.source || '—');

  const status = root?.getElementById?.('securityStatus');
  if (status) {
    status.textContent = summary.lastScan
      ? `Scan importado e normalizado (${state?.scan?.format || 'formato interno'}).`
      : 'Nenhum scan importado. O módulo não executa BBOT no navegador.';
  }

  const body = root?.getElementById?.('securityAssetsBody');
  if (body) {
    body.replaceChildren();
    const assets = Array.isArray(state?.assets) ? state.assets.slice(0, 100) : [];
    if (!assets.length) {
      appendEmptyRow(root, body, 'Importe um JSON/JSONL autorizado ou carregue o exemplo.');
    } else {
      for (const asset of assets) {
        const row = root.createElement('tr');
        const typeCell = root.createElement('td');
        const valueCell = root.createElement('td');
        const detailCell = root.createElement('td');
        const sourceCell = root.createElement('td');

        typeCell.textContent = asset.type || 'asset';
        valueCell.textContent = asset.value || asset.host || '—';
        detailCell.textContent = assetDetails(asset);
        sourceCell.textContent = [
          asset.sourceModule || '—',
          Number.isFinite(asset.scopeDistance) ? `distância ${asset.scopeDistance}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        row.append(typeCell, valueCell, detailCell, sourceCell);
        body.appendChild(row);
      }
    }
  }

  const findingsList = root?.getElementById?.('securityFindingsList');
  if (findingsList) {
    findingsList.replaceChildren();
    const findings = Array.isArray(state?.findings) ? state.findings : [];
    if (!findings.length) {
      const item = root.createElement('li');
      item.className = 'muted';
      item.textContent = 'Nenhum finding importado neste scan.';
      findingsList.appendChild(item);
    } else {
      for (const finding of findings.slice(0, 50)) {
        const item = root.createElement('li');
        const prefix = [finding.severity, finding.host].filter(Boolean).join(' · ');
        item.textContent = prefix ? `${prefix}: ${finding.description}` : finding.description;
        findingsList.appendChild(item);
      }
    }
  }
}
