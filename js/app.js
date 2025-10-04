// App extracted from inline script in index.html
// This file is loaded as a module via <script type="module" src="js/app.js"></script>

import { normalizeEntry, sanitizeImportPayload, satsFrom as sanitizerSatsFrom } from './import-sanitizer.js';

document.addEventListener("DOMContentLoaded", () => {
    // =====================
    // Estado & Storage
    // =====================
    const STORAGE_KEY = 'btcJournalV1';
    const state = {
      vs: 'eur',
      year: new Date().getFullYear(),
      prices: [],
      ohlc: [],
      chartMode: 'line',
      entries: loadEntries(),
      chart: null,
      editingEntryId: null, // Para controlar qual aporte está a ser editado
    };

    // Restaurar preferência de visualização (linha / candles)
    try {
      const savedMode = localStorage.getItem('btcJournalChartMode');
      if (savedMode) state.chartMode = savedMode;
    } catch (e) { /* no-op */ }

    function loadEntries() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch (e) { console.error("Erro ao carregar entradas:", e); return []; }
    }
    function saveEntries() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
    }
    function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

    // =====================
    // UI helpers
    // =====================
    const $ = sel => document.querySelector(sel);
    const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    function setLoading(isLoading) {
      const overlay = $('#loadingOverlay');
      if (isLoading) {
        overlay.classList.add('visible');
      } else {
        overlay.classList.remove('visible');
      }
      $('#fetchPriceBtn').disabled = isLoading;
      $('#vsCurrency').disabled = isLoading;
      $('#addBtn').disabled = isLoading;
      // Desabilitar botões de edição/exclusão durante o carregamento
      document.querySelectorAll('.entry button').forEach(btn => btn.disabled = isLoading);
    }

    function fmt(n, dec = 2) {
      if (Number.isNaN(n) || !isFinite(n)) return '—';
      return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
    }

    function satsFrom(fiat, price) {
      if (!price || !fiat || price <= 0) return 0;
      const btc = fiat / price;
      return Math.floor(btc * 1e8);
    }

    function plFor(entry, currentPrice) {
      const btc = entry.sats / 1e8;
      const invested = (entry.fiat + (entry.fee || 0));
      const nowValue = btc * currentPrice;
      const pl = nowValue - invested;
      const pct = invested > 0 ? (pl / invested) * 100 : 0;
      return { pl, pct };
    }

    function pmMedio(entries) {
      let btcTot = 0, custoTot = 0;
      for (const e of entries.filter(x => !x.closed)) {
        const btc = e.sats / 1e8;
        custoTot += (e.fiat + (e.fee || 0));
        btcTot += btc;
      }
      if (btcTot === 0) return 0;
      return custoTot / btcTot;
    }

    function totalInvested(entries) {
      return entries.filter(e => !e.closed).reduce((sum, e) => sum + (e.fiat + (e.fee || 0)), 0);
    }

    function currentPortfolioValue(entries, currentPrice) {
      return entries.filter(e => !e.closed).reduce((sum, e) => sum + (e.sats / 1e8 * currentPrice), 0);
    }

    function totalReturnPercentage(entries, currentPrice) {
      const invested = totalInvested(entries);
      const currentValue = currentPortfolioValue(entries, currentPrice);
      if (invested === 0) return 0;
      return ((currentValue - invested) / invested) * 100;
    }

    // =====================
    // Preços (CoinGecko)
    // =====================
    async function fetchPrices(days = 400) {
      setLoading(true);
      try {
        const vs = state.vs;
        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=${vs}&days=${days}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API do CoinGecko falhou: ${res.statusText}`);
        const data = await res.json();
        state.prices = (data.prices || []).map(([t, p]) => ({ t, p }));
      } catch (error) {
        console.error("Erro ao buscar preços:", error);
        alert("Não foi possível carregar os dados de preços. Por favor, verifique a sua conexão e tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    async function fetchOHLC(days = 90) {
      setLoading(true);
      try {
        const vs = state.vs;
        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=${vs}&days=${days}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CoinGecko OHLC falhou: ${res.statusText}`);
        const data = await res.json();
        // data: array de [timestamp, open, high, low, close]
        state.ohlc = (data || []).map(d => ({ t: d[0], o: d[1], h: d[2], l: d[3], c: d[4] }));
      } catch (err) {
        console.warn('Não foi possível carregar OHLC:', err);
        state.ohlc = [];
      } finally {
        setLoading(false);
      }
    }

    async function fetchHistoricalPriceForDate(dateStr) {
      const ts = new Date(dateStr + 'T12:00:00').getTime();
      if (!state.prices.length) await fetchPrices(2000);
      let best = null, bestDiff = Infinity;
      for (const pt of state.prices) {
        const d = Math.abs(pt.t - ts);
        if (d < bestDiff) { bestDiff = d; best = pt; }
      }
      return best ? best.p : null;
    }

    function currentPrice() {
      if (!state.prices.length) return 0;
      return state.prices[state.prices.length - 1].p;
    }

    // =====================
    // Renders
    // =====================
    function renderAll() {
        renderKPI();
        renderMonths();
        renderChart();
    }

    // =====================
    // UI wiring
    // =====================
    // Chart mode select
    const chartModeSelect = $('#chartMode');
    chartModeSelect.value = state.chartMode;
    chartModeSelect.addEventListener('change', async (e) => {
      state.chartMode = e.target.value;
      try { localStorage.setItem('btcJournalChartMode', state.chartMode); } catch (err) { /* no-op */ }
      if (state.chartMode === 'candles') {
        // obter OHLC (90 dias por padrão) e re-render
        await fetchOHLC(90);
      }
      renderChart();
    });

    // vsCurrency change should refresh prices and ohlc
    $('#vsCurrency').addEventListener('change', async (e) => {
      state.vs = e.target.value;
      await fetchPrices(400);
      if (state.chartMode === 'candles') await fetchOHLC(90);
      renderAll();
    });

    function renderChart() {
      const ctx = document.getElementById('btcChart').getContext('2d');
      const labels = state.prices.map(pt => pt.t);
      const priceData = state.prices.map(pt => pt.p);
      const points = state.entries.filter(e => !e.closed).map(e => ({ x: new Date(e.date).getTime(), y: e.price }));
      
      const averagePrice = pmMedio(state.entries);

        // Monta datasets dinamicamente: linha de preço sempre disponível; candles opcionais
        const datasets = [];

        // Candles (quando disponíveis e modo selecionado)
        if (state.ohlc && state.ohlc.length > 0 && (state.chartMode === 'candles' || state.chartMode === undefined)) {
          // Mapear para o formato do plugin: {x: timestamp, o, h, l, c}
          const candData = state.ohlc.map(d => ({ x: d.t, o: d.o, h: d.h, l: d.l, c: d.c }));
          datasets.push({
            label: 'OHLC',
            type: 'candlestick',
            data: candData,
            fractionalDigitsCount: 2,
            borderColor: ctx && ctx.canvas ? undefined : undefined,
            // colorização por vela: verde para alta, vermelho para baixa
            color: { up: 'rgba(34,197,94,0.95)', down: 'rgba(239,68,68,0.95)' }
          });
        }

        // Linha de preço histórico (manteve-se)
        datasets.push({ label: `BTC/${state.vs.toUpperCase()}`, data: priceData, parsing: false, borderWidth: 1.8, tension: 0.15, borderColor: 'var(--brand)', type: 'line' });

        // Scatter de aportes (sempre acima)
        datasets.push({ type: 'scatter', label: 'Aportes (abertos)', data: points, pointRadius: 4, pointHoverRadius: 6, backgroundColor: 'var(--green)', order: 10 });

        const data = { labels, datasets };

      const cfg = {
        type: 'line',
        data,
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', time: { unit: 'month' }, grid: { color: '#1e2432' } },
            y: { grid: { color: '#1e2432' } }
          },
          plugins: {
            legend: { labels: { color: '#cbd5e1' } },
            tooltip: { mode: 'nearest', intersect: false },
            annotation: {
              annotations: {
                line1: {
                  type: 'line',
                  yMin: averagePrice,
                  yMax: averagePrice,
                  borderColor: 'var(--muted)',
                  borderWidth: 1.5,
                  borderDash: [6, 6],
                  display: averagePrice > 0, // Só mostra a linha se houver um PM > 0
                  label: {
                    content: `PM: ${fmt(averagePrice)}`,
                    position: 'end',
                    backgroundColor: 'rgba(138, 148, 166, 0.2)',
                    color: 'var(--muted)',
                    font: { size: 10 },
                    padding: { x: 4, y: 2 },
                    borderRadius: 4,
                    yAdjust: -10,
                  }
                }
              }
            }
          }
        }
      };

      if (state.chart) { state.chart.destroy(); }
      state.chart = new Chart(ctx, cfg);
    }

    function renderMonths() {
      const grid = $('#monthsGrid');
      grid.innerHTML = '';
      const price = currentPrice();
      for (let m = 0; m < 12; m++) {
        const box = document.createElement('div');
        box.className = 'monthBox';
        const monthEntries = state.entries
        .filter(e => !e.deleted && new Date(e.date).getFullYear() === state.year && new Date(e.date).getMonth() === m)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

        const head = document.createElement('div');
        head.className = 'monthHead';
        head.innerHTML = `<span>${monthsShort[m]} ${state.year}</span><span class=\"muted\">${monthEntries.length} aporte(s)</span>`;
        box.appendChild(head);

        if (monthEntries.length === 0) {
          const empty = document.createElement('div'); empty.className = 'note';
          empty.textContent = 'Sem entradas';
          box.appendChild(empty);
        } else {
          for (const e of monthEntries) {
            const { pl, pct } = plFor(e, price);
            const cls = e.closed ? 'flat' : (pl > 0 ? 'up' : (pl < 0 ? 'down' : 'flat'));
            const div = document.createElement('div');
            div.className = 'entry';
            const dateNice = new Date(e.date).toLocaleDateString('pt-PT');
            div.innerHTML = `
              <div class=\"tags\">\n                <span class=\"tag\">${dateNice}</span>\n                <span class=\"tag\">${fmt(e.fiat)} ${state.vs.toUpperCase()}</span>\n                <span class=\"tag\">PM: ${fmt(e.price)}</span>\n                ${e.closed ? '<span class=\"tag\">Fechado</span>' : ''}\n              </div>\n              <div style=\"display:flex; align-items:center; gap:8px;\">\n                <span class=\"pl ${cls}\">${pl >= 0 ? '+' : ''}${fmt(pl)} (${fmt(pct, 1)}%)</span>\n                <button class=\"ghost\" data-act=\"toggle\" data-id=\"${e.id}\">${e.closed ? 'Reabrir' : 'Fechar'}</button>\n                <button class=\"ghost\" data-act=\"edit\" data-id=\"${e.id}\">Editar</button> <!-- NOVO: Botão Editar -->\n                <button class=\"ghost\" data-act=\"del\" data-id=\"${e.id}\">Apagar</button>\n              </div>`;
            box.appendChild(div);
          }
        }
        grid.appendChild(box);
      }
    }

    function renderKPI() {
      const price = currentPrice();
      const openEntries = state.entries.filter(e => !e.closed);

      $('#kpiPrice').textContent = `${fmt(price)} ${state.vs.toUpperCase()}`;
      $('#kpiUpdated').textContent = price > 0 ? `Atualizado: ${new Date().toLocaleString('pt-PT')}` : 'A aguardar dados...';
      $('#kpiOpen').textContent = openEntries.length;

      let plSum = 0;
      for (const e of openEntries) {
        plSum += plFor(e, price).pl;
      }
      $('#kpiPL').textContent = `${plSum >= 0 ? '+' : ''}${fmt(plSum)} ${state.vs.toUpperCase()}`;
      
      const pm = pmMedio(state.entries);
      $('#kpiPM').textContent = pm > 0 ? `${fmt(pm)} ${state.vs.toUpperCase()}` : '—';

      const totalInv = totalInvested(state.entries);
      $('#kpiTotalInvested').textContent = `${fmt(totalInv)} ${state.vs.toUpperCase()}`;

      const currentVal = currentPortfolioValue(state.entries, price);
      $('#kpiCurrentValue').textContent = `${fmt(currentVal)} ${state.vs.toUpperCase()}`;

      const totalReturnPct = totalReturnPercentage(state.entries, price);
      const totalReturnCls = totalReturnPct > 0 ? 'up' : (totalReturnPct < 0 ? 'down' : 'flat');
      $('#kpiTotalReturnPct').textContent = `${totalReturnPct >= 0 ? '+' : ''}${fmt(totalReturnPct, 2)}%`;
      $('#kpiTotalReturnPct').className = `value pl ${totalReturnCls}`;
    }

    // =====================
    // Produtividade (novo)
    // =====================
    function monthsWithContributions(year) {
      const months = new Set();
      for (const e of state.entries) {
        if (e.deleted) continue;
        const d = new Date(e.date);
        if (d.getFullYear() === year) months.add(d.getMonth());
      }
      return Array.from(months).sort((a,b)=>a-b);
    }

    function avgPerMonth(year) {
      const months = monthsWithContributions(year);
      const total = state.entries.filter(e => !e.deleted && new Date(e.date).getFullYear() === year).length;
      return months.length === 0 ? 0 : total / 12; // média sobre 12 meses
    }

    function currentStreak() {
      // Conta meses consecutivos (mais recente -> passado) com ao menos 1 aporte
      const now = new Date();
      let streak = 0;
      for (let i = 0; i < 24; i++) { // limite 2 anos
        const check = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthHas = state.entries.some(e => {
          if (e.deleted) return false;
          const d = new Date(e.date);
          return d.getFullYear() === check.getFullYear() && d.getMonth() === check.getMonth();
        });
        if (monthHas) streak++; else break;
      }
      return streak;
    }

    function updateProductivityCard() {
      try {
        const months = monthsWithContributions(state.year);
        $('#prodMonths').textContent = months.length;
        $('#prodAvg').textContent = fmt(avgPerMonth(state.year), 2);
        $('#prodStreak').textContent = currentStreak();

        // Desafio: 1 aporte / mês no ano corrente
        const monthsFilled = monthsWithContributions(new Date().getFullYear()).length;
        const progress = Math.min(monthsFilled, 12);
        $('#prodProgress').value = progress;
        $('#prodProgressLabel').textContent = `${progress}/12`;
      } catch (err) { console.warn('Erro ao atualizar produtividade', err); }
    }

    // Desafio simples: persistir status em localStorage
    const CHALLENGE_KEY = 'btcJournal.challenge.1pm';
    function startChallenge() { localStorage.setItem(CHALLENGE_KEY, JSON.stringify({ startedAt: new Date().toISOString() })); updateChallengeButtons(); }
    function stopChallenge() { localStorage.removeItem(CHALLENGE_KEY); updateChallengeButtons(); }
    function updateChallengeButtons() {
      const running = !!localStorage.getItem(CHALLENGE_KEY);
      $('#startChallengeBtn').disabled = running;
      $('#stopChallengeBtn').disabled = !running;
    }

    // Integrar atualização de produtividade ao renderAll
    const oldRenderAll = renderAll;
    function renderAll() {
      renderKPI();
      renderMonths();
      renderChart();
      updateProductivityCard();
      updateChallengeButtons();
    }

    // Interações
    function hydrateYearOptions() {
      const sel = $('#yearSelect');
      const cur = new Date().getFullYear();
      const years = [cur - 2, cur - 1, cur, cur + 1];
      sel.innerHTML = years.map(y => `<option value=\"${y}\" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('');
    }

    function bindEvents() {
      $('#vsCurrency').addEventListener('change', async (e) => {
        state.vs = e.target.value;
        await fetchPrices(800);
        renderAll();
      });
      $('#yearSelect').addEventListener('change', (e) => {
        state.year = parseInt(e.target.value, 10);
        renderMonths();
      });
      $('#resetBtn').addEventListener('click', () => {
        if (confirm('Tem a certeza que quer apagar todos os aportes salvos localmente? Esta ação é irreversível.')) {
          state.entries = [];
          saveEntries();
          renderAll();
        }
      });
      $('#fetchPriceBtn').addEventListener('click', async () => {
        const dateStr = $('#dateInput').value;
        if (!dateStr) { alert('Por favor, escolha uma data primeiro.'); return; }
        const p = await fetchHistoricalPriceForDate(dateStr);
        if (p) { $('#priceInput').value = Number(p).toFixed(2); recalcSats(); }
        else alert('Não foi possível obter o preço para essa data.');
      });
      $('#fiatInput').addEventListener('input', recalcSats);
      $('#priceInput').addEventListener('input', recalcSats);
      $('#addBtn').addEventListener('click', () => {
        const dateStr = $('#dateInput').value;
        const price = parseFloat($('#priceInput').value);
        const fiat = parseFloat($('#fiatInput').value);
        const fee = parseFloat($('#feeInput').value) || 0;
        if (!dateStr || !isFinite(price) || !isFinite(fiat) || price <= 0) {
          alert('Preencha, no mínimo, a data, o preço do BTC (maior que zero) e o valor do aporte.'); return;
        }
        const sats = satsFrom(fiat, price);
        const entry = { id: uid(), date: dateStr, price, fiat, fee, sats, closed: false, weight: parseFloat($('#weightInput').value) || null };
        state.entries.push(entry);
        saveEntries();
        renderAll();
        $('#fiatInput').value = '';
        $('#feeInput').value = '';
        $('#satsOutput').value = '';
        $('#weightInput').value = '';
      });
      $('#monthsGrid').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-id]');
        if (!btn) return;
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        const idx = state.entries.findIndex(x => x.id === id);
        if (idx < 0) return;

        if (act === 'toggle') {
          state.entries[idx].closed = !state.entries[idx].closed;
        } else if (act === 'del') {
          if (confirm('Tem a certeza que quer apagar este aporte?')) {
            state.entries.splice(idx, 1);
          }
        } else if (act === 'edit') { 
        state.editingEntryId = id;
        const entryToEdit = state.entries[idx];
        $('#editDateInput').value = entryToEdit.date;
        $('#editPriceInput').value = entryToEdit.price;
        $('#editFiatInput').value = entryToEdit.fiat;
        $('#editFeeInput').value = entryToEdit.fee;
        $('#editWeightInput').value = entryToEdit.weight;
        $('#editModal').style.display = 'flex'; 
        }
        saveEntries();
        renderAll();
      });
      $('#exportBtn').addEventListener('click', () => {
        const dataStr = JSON.stringify({ vs: state.vs, year: state.year, entries: state.entries }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `btc-journal-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      // REGION: Import Validation + Backup (delegated to shared module)
      function backupLocalData() {
        try {
          const snap = localStorage.getItem('btcJournalV1') ?? '[]';
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          localStorage.setItem(`btcJournalV1.bak.${stamp}`, snap);
        } catch (e) { console.error('Falha ao criar backup local:', e); }
      }

  // usar as funções importadas do módulo sanitizer

      function listBackups() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('btcJournalV1.bak.')) keys.push(k);
        }
        // ordenar descendente (mais recente primeiro)
        return keys.sort().reverse();
      }

      async function restoreBackup(key) {
        if (!key) return false;
        const val = localStorage.getItem(key);
        if (!val) return false;
        try {
          const parsed = JSON.parse(val);
          if (!Array.isArray(parsed) && !(parsed && parsed.entries)) {
            if (!Array.isArray(parsed)) {
              alert('Formato do backup inválido. Restauração abortada.');
              return false;
            }
          }
          // confirmar
          if (!confirm('Tem a certeza que quer restaurar este backup? Os dados atuais serão substituídos.')) return false;
          // aplicar
          const payload = Array.isArray(parsed) ? { entries: parsed } : parsed;
          const res = sanitizeImportPayload(payload);
          if (!res.ok) { alert('O backup contém entradas inválidas e não pode ser restaurado.'); return false; }
          // criar backup atual antes de sobrescrever
          backupLocalData();
          state.entries = res.entries;
          if (res.vs) state.vs = res.vs;
          if (res.year) state.year = res.year;
          saveEntries();
          await fetchPrices(800);
          if (state.chartMode === 'candles') await fetchOHLC(90);
          renderAll();
          alert('Backup restaurado com sucesso.');
          return true;
        } catch (err) {
          console.error('Erro ao restaurar backup:', err);
          alert('Erro ao restaurar backup. Veja a consola para mais detalhes.');
          return false;
        }
      }

      $('#importInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          const res = sanitizeImportPayload(parsed);
          if (!res.ok) { alert(res.reason); e.target.value = ''; return; }

          // Aviso sobre grande quantidade de entradas
          if (res.entries.length > 5000) {
            if (!confirm(`O ficheiro contém ${res.entries.length} entradas — isto é muito grande e pode afectar o navegador. Quer continuar?`)) { e.target.value = ''; return; }
          }

          let proceedMsg = `Foram encontradas ${res.entries.length} entradas válidas.`;
          if (res.invalid && res.invalid.length) proceedMsg += ` ${res.invalid.length} entradas inválidas serão ignoradas.`;
          proceedMsg += '\nQuer substituir os seus dados locais por estas entradas válidas?';

          if (!confirm(proceedMsg)) { e.target.value = ''; return; }

          // Backup antes de sobrescrever
          backupLocalData();

          // Aplicar alterações
          state.entries = res.entries;
          state.vs = res.vs;
          state.year = res.year;
          try { $('#vsCurrency').value = state.vs; } catch (err) {}
          try { $('#yearSelect').value = state.year; } catch (err) {}
          saveEntries();
          await fetchPrices(800);
          if (state.chartMode === 'candles') await fetchOHLC(90);
          renderAll();
          alert(`Import concluído: ${res.entries.length} entradas importadas com sucesso.`);
        } catch (err) {
          console.error('Erro ao importar JSON:', err);
          alert('Ocorreu um erro ao processar o ficheiro. Verifique se é um JSON válido e se o formato corresponde ao esperado.');
        }
        e.target.value = '';
      });

      // Restore backups buttons
      $('#restoreLastBackupBtn').addEventListener('click', async () => {
        const keys = listBackups();
        if (!keys.length) { alert('Nenhum backup local encontrado.'); return; }
        const last = keys[0];
        if (confirm('Restaurar o último backup local? Esta ação substituirá os seus dados atuais.')) {
          await restoreBackup(last);
        }
      });

      $('#chooseBackupBtn').addEventListener('click', async () => {
        const keys = listBackups();
        if (!keys.length) { alert('Nenhum backup local encontrado.'); return; }
        // Mostrar menu simples: lista com índices
        const menu = keys.map((k, i) => `${i + 1}. ${k}`).join('\n');
        const choice = prompt(`Backups locais:\n${menu}\n\nDigite o número do backup a restaurar:`);
        if (!choice) return;
        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= keys.length) { alert('Seleção inválida.'); return; }
        await restoreBackup(keys[idx]);
      });

      // NOVO: Eventos do Modal de Edição
      $('.close-button').addEventListener('click', () => {
        $('#editModal').style.display = 'none';
        state.editingEntryId = null;
      });
      $('#saveEditBtn').addEventListener('click', () => {
        if (!state.editingEntryId) return;
        const idx = state.entries.findIndex(e => e.id === state.editingEntryId);
        if (idx < 0) return;

        const newDate = $('#editDateInput').value;
        const newPrice = parseFloat($('#editPriceInput').value);
        const newFiat = parseFloat($('#editFiatInput').value);
        const newFee = parseFloat($('#editFeeInput').value) || 0;
        const newWeight = parseFloat($('#editWeightInput').value) || null;

        if (!newDate || !isFinite(newPrice) || !isFinite(newFiat) || newPrice <= 0) {
          alert('Preencha, no mínimo, a data, o preço do BTC (maior que zero) e o valor do aporte.'); return;
        }

        state.entries[idx].date = newDate;
        state.entries[idx].price = newPrice;
        state.entries[idx].fiat = newFiat;
        state.entries[idx].fee = newFee;
        state.entries[idx].sats = satsFrom(newFiat, newPrice); // Recalcula sats
        state.entries[idx].weight = newWeight;

        saveEntries();
        renderAll();
        $('#editModal').style.display = 'none';
        state.editingEntryId = null;
      });
      // Fechar modal ao clicar fora dele
      window.addEventListener('click', (event) => {
        if (event.target == $('#editModal')) {
          $('#editModal').style.display = 'none';
          state.editingEntryId = null;
        }
      });
      // Eventos de produtividade
      $('#startChallengeBtn').addEventListener('click', () => { startChallenge(); alert('Desafio iniciado. Boa sorte!'); });
      $('#stopChallengeBtn').addEventListener('click', () => { if (confirm('Parar o desafio? O progresso atual será mantido nos registos.')) { stopChallenge(); } });
    }

    function recalcSats() {
      const fiat = parseFloat($('#fiatInput').value);
      const price = parseFloat($('#priceInput').value);
      if (isFinite(fiat) && isFinite(price) && price > 0) {
        const sats = satsFrom(fiat, price);
        $('#satsOutput').value = new Intl.NumberFormat('pt-PT').format(sats);
        $('#avgOutput').value = fmt(price);
      } else {
        $('#satsOutput').value = '';
        $('#avgOutput').value = '';
      }
    }

    // Boot
    async function boot() {
      Chart.register(ChartjsPluginAnnotation);

      hydrateYearOptions();
      bindEvents();
      $('#vsCurrency').value = state.vs;
      $('#dateInput').valueAsDate = new Date();
      
      await fetchPrices(800);
      if (state.chartMode === 'candles') await fetchOHLC(90);
      renderAll();
    }

    boot();

});

