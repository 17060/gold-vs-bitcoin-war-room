// Gold vs Bitcoin War Room — interactive logic + snapshot cards

const OZ_PER_TONNE = 32150.7;
const OZ_PER_KG    = 32.1507;
const G_PER_OZ     = 31.1035;
const SATS_PER_BTC = 100_000_000;

const fmtUSD = (n, d=0) => '$' + (n>=1e12 ? (n/1e12).toFixed(2)+'T'
  : n>=1e9 ? (n/1e9).toFixed(2)+'B'
  : n>=1e6 ? (n/1e6).toFixed(1)+'M'
  : n.toLocaleString('en-US',{maximumFractionDigits:d}));
const fmtNum = (n, d=2) => n.toLocaleString('en-US', {maximumFractionDigits:d, minimumFractionDigits:d});
const fmtPct = n => (n>=0?'+':'') + n.toFixed(1) + '%';
const fmtPrice = n => '$' + n.toLocaleString('en-US',{maximumFractionDigits:2});

const COLORS = { gold:'#f5b945', goldhi:'#fde08a', btc:'#f7931a', btchi:'#ffb45a', cyan:'#22d3ee', mute:'#7a8694' };

let MARKET, CTX;

async function bootstrap() {
  const [m, c] = await Promise.all([
    fetch('market_data.json').then(r=>r.json()),
    fetch('context_data.json').then(r=>r.json())
  ]);
  MARKET = m; CTX = c;
  populate();
}

function populate() {
  // header
  document.getElementById('asof').textContent = MARKET.as_of;
  document.getElementById('footer-asof').textContent = MARKET.as_of;

  // headline stats
  const goldPrice = MARKET.latest.xauusd;
  const btcPrice  = MARKET.latest.btcusd;
  document.getElementById('gold-price').textContent = fmtPrice(goldPrice);
  document.getElementById('btc-price').textContent  = fmtPrice(btcPrice);
  const r1m = MARKET.returns['1m'];
  document.getElementById('gold-chg').innerHTML = `<span class="${r1m.xauusd>=0?'up':'down'}">${fmtPct(r1m.xauusd)} 30d</span> · 1Y <span class="${MARKET.returns['1y'].xauusd>=0?'up':'down'}">${fmtPct(MARKET.returns['1y'].xauusd)}</span>`;
  document.getElementById('btc-chg').innerHTML = `<span class="${r1m.btcusd>=0?'up':'down'}">${fmtPct(r1m.btcusd)} 30d</span> · 1Y <span class="${MARKET.returns['1y'].btcusd>=0?'up':'down'}">${fmtPct(MARKET.returns['1y'].btcusd)}</span>`;
  document.getElementById('btc-mcap').textContent = fmtUSD(CTX.valuation_metrics.bitcoin_market_cap_usd);
  document.getElementById('btc-mcap-ratio').textContent = `Gold is ${CTX.valuation_metrics.ratio_gold_to_btc_mcap.toFixed(1)}× larger`;

  // ticker
  buildTicker();

  // returns grid
  buildReturnsGrid();

  // central bank holders & chart
  buildHolders();
  drawCBChart();

  // ETFs
  buildETFList();

  // vol & corr
  drawVolChart();
  buildCorrMatrix();
  document.getElementById('vol-gold').textContent = MARKET.volatility['1y'].xauusd.toFixed(1) + '%';
  document.getElementById('vol-btc').textContent  = MARKET.volatility['1y'].btcusd.toFixed(1) + '%';
  document.getElementById('dd-gold').textContent  = MARKET.max_drawdown_5y.xauusd.toFixed(1) + '%';
  document.getElementById('dd-btc').textContent   = MARKET.max_drawdown_5y.btcusd.toFixed(1) + '%';
  document.getElementById('corr-key').textContent = MARKET.correlations_1y.xauusd.btcusd.toFixed(2);

  // exchange rate panel
  buildExchangePanel();

  // time machine
  buildTimeMachine();

  // debasement
  buildDebasement();

  // scoreboard
  buildScoreboard();

  // narratives
  buildList('bull-gold', CTX.narratives.gold_bull, 'gold');
  buildList('bear-gold', CTX.narratives.gold_bear, 'mute');
  buildList('bull-btc',  CTX.narratives.btc_bull,  'btc');
  buildList('bear-btc',  CTX.narratives.btc_bear,  'mute');

  // price chart
  drawPriceChart('5y','normalized', true);
  document.querySelectorAll('.window-btn').forEach(b => b.addEventListener('click', e => {
    document.querySelectorAll('.window-btn').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    refreshPrice();
  }));
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', e => {
    document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    refreshPrice();
  }));
  document.getElementById('show-regimes').addEventListener('change', refreshPrice);

  // halving countdown
  startHalvingCountdown();

  // allocation simulator
  updateSim();
  document.getElementById('gold-slider').addEventListener('input', updateSim);
  document.getElementById('btc-slider').addEventListener('input', updateSim);

  // snapshot
  document.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => openSnapshot(b.dataset.snap)));
  document.getElementById('snap-close').addEventListener('click', () => document.getElementById('snap-overlay').style.display='none');
  document.getElementById('snap-download').addEventListener('click', downloadSnapshot);
}

function buildTicker() {
  const items = [
    { label:'XAU/USD', val: fmtPrice(MARKET.latest.xauusd), ch: MARKET.returns['1m'].xauusd },
    { label:'BTC/USD', val: fmtPrice(MARKET.latest.btcusd), ch: MARKET.returns['1m'].btcusd },
    { label:'S&P 500', val: MARKET.latest.gspc.toLocaleString('en-US',{maximumFractionDigits:0}), ch: MARKET.returns['1m'].gspc },
    { label:'DXY',     val: MARKET.latest.dxy.toFixed(2), ch: 0 },
    { label:'Gold 1Y', val: '', ch: MARKET.returns['1y'].xauusd },
    { label:'BTC 1Y',  val: '', ch: MARKET.returns['1y'].btcusd },
    { label:'Gold 5Y', val: '', ch: MARKET.returns['5y'].xauusd },
    { label:'BTC 5Y',  val: '', ch: MARKET.returns['5y'].btcusd },
    { label:'BTC 10Y', val: '', ch: MARKET.returns['10y'].btcusd },
    { label:'CB gold 25', val:'863t', ch:null, neutral:true },
    { label:'BTC ETF AUM', val:'$100.1B', ch:null, neutral:true },
    { label:'US HH NW', val:'$175.3T', ch:null, neutral:true },
  ];
  const html = items.map(i => {
    let cls = i.neutral ? 'neutral' : (i.ch >= 0 ? 'up' : 'down');
    let sign = i.ch === null ? '' : (i.ch >= 0 ? '▲' : '▼') + ' ' + fmtPct(i.ch);
    return `<span class="ticker-item"><span style="color:#fde08a">${i.label}</span>${i.val? '<span>'+i.val+'</span>':''}<span class="${cls}">${sign}</span></span>`;
  }).join('');
  document.getElementById('ticker').innerHTML = html + html; // double for seamless loop
}

function buildReturnsGrid() {
  const windows = [['1m','30D'],['3m','3M'],['ytd','YTD'],['1y','1Y'],['5y','5Y'],['10y','10Y']];
  const html = windows.map(([k,label]) => {
    const r = MARKET.returns[k];
    return `<div class="border border-edge p-3">
      <div class="mono text-[10px] uppercase tracking-widest text-mute">${label}</div>
      <div class="text-xs mt-2"><span class="text-mute">Gold </span><span class="mono ${r.xauusd>=0?'up':'down'}">${fmtPct(r.xauusd)}</span></div>
      <div class="text-xs mt-1"><span class="text-mute">BTC </span><span class="mono ${r.btcusd>=0?'up':'down'}">${fmtPct(r.btcusd)}</span></div>
      <div class="text-xs mt-1"><span class="text-mute">SPX </span><span class="mono ${r.gspc>=0?'up':'down'}">${fmtPct(r.gspc)}</span></div>
    </div>`;
  }).join('');
  document.getElementById('returns-grid').innerHTML = html;
}

function buildHolders() {
  const max = CTX.central_banks.top_holders[0].tonnes;
  const html = CTX.central_banks.top_holders.slice(0,12).map(h => {
    const w = (h.tonnes / max * 100).toFixed(1);
    return `<div class="country-row flex items-center gap-3 py-1.5">
      <span class="mono text-[10px] text-mute w-8">${h.code}</span>
      <span class="flex-1">${h.country}</span>
      <div class="w-24 bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
      <span class="mono text-xs text-goldhi w-16 text-right">${h.tonnes.toLocaleString()}t</span>
    </div>`;
  }).join('');
  document.getElementById('holders-list').innerHTML = html;
}

function drawCBChart() {
  const ctx = document.getElementById('cbChart').getContext('2d');
  const series = CTX.central_banks.annual_series;
  new Chart(ctx, {
    type:'bar',
    data:{
      labels: series.map(s=>s.year),
      datasets: [{
        data: series.map(s=>s.tonnes),
        backgroundColor: series.map(s => s.year===2025 ? '#fde08a' : 'rgba(245,185,69,0.55)'),
        borderColor: '#f5b945',
        borderWidth: 1,
      }]
    },
    options: chartOpts({
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c => c.parsed.y + 't' } } },
      scales: {
        y: { ticks:{ color:'#7a8694', callback:v=>v+'t'}, grid:{ color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}},
        x: { ticks:{ color:'#7a8694'}, grid:{ display:false}, border:{color:'rgba(255,255,255,0.08)'}}
      }
    })
  });
}

function buildETFList() {
  const total = CTX.households.spot_btc_etf_aum_usd;
  const html = CTX.households.etfs.map(e => {
    const w = (e.aum_usd/total*100).toFixed(1);
    return `<div>
      <div class="flex justify-between"><span>${e.ticker} <span class="text-mute text-xs">· ${e.issuer}</span></span><span class="mono" style="color:#ffb45a">${fmtUSD(e.aum_usd)}</span></div>
      <div class="bar-track mt-1"><div class="bar-fill btc" style="width:${w}%"></div></div>
    </div>`;
  }).join('');
  document.getElementById('etf-list').innerHTML = html;
}

function drawVolChart() {
  const ctx = document.getElementById('volChart').getContext('2d');
  const labels = ['30D','90D','1Y'];
  new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Gold', data:[MARKET.volatility['30d'].xauusd, MARKET.volatility['90d'].xauusd, MARKET.volatility['1y'].xauusd], backgroundColor:'#f5b945' },
        { label:'BTC',  data:[MARKET.volatility['30d'].btcusd, MARKET.volatility['90d'].btcusd, MARKET.volatility['1y'].btcusd], backgroundColor:'#f7931a' },
        { label:'SPX',  data:[MARKET.volatility['30d'].gspc, MARKET.volatility['90d'].gspc, MARKET.volatility['1y'].gspc], backgroundColor:'#475569' },
      ]
    },
    options: chartOpts({
      plugins:{ legend:{ labels:{ color:'#a8b3c0', font:{family:'JetBrains Mono'}, boxWidth:10 }}, tooltip:{ callbacks:{ label:c=>c.dataset.label+': '+c.parsed.y.toFixed(1)+'%' }}},
      scales:{
        y:{ ticks:{ color:'#7a8694', callback:v=>v+'%'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}},
        x:{ ticks:{ color:'#7a8694'}, grid:{display:false}, border:{color:'rgba(255,255,255,0.08)'}}
      }
    })
  });
}

function buildCorrMatrix() {
  const c = MARKET.correlations_1y;
  const labels = [['xauusd','Gold'],['btcusd','BTC'],['gspc','SPX'],['dxy','DXY']];
  let html = '<div style="display:grid;grid-template-columns:60px repeat(4,1fr);gap:4px;">';
  // header row
  html += '<div></div>';
  labels.forEach(l => html += `<div class="mono text-[10px] uppercase tracking-widest text-mute text-center pb-2">${l[1]}</div>`);
  // data rows
  labels.forEach(row => {
    html += `<div class="mono text-[10px] uppercase tracking-widest text-mute self-center">${row[1]}</div>`;
    labels.forEach(col => {
      const v = c[row[0]][col[0]];
      const intensity = Math.abs(v);
      let bg, fg='#e3e9f0';
      if (row[0]===col[0]) { bg = 'rgba(255,255,255,0.04)'; fg='#7a8694'; }
      else if (v >= 0) bg = `rgba(245,185,69,${0.15 + intensity*0.55})`;
      else bg = `rgba(34,211,238,${0.15 + intensity*0.55})`;
      html += `<div class="mono text-sm font-semibold text-center py-3" style="background:${bg};color:${fg};">${v.toFixed(2)}</div>`;
    });
  });
  html += '</div>';
  html += '<div class="mt-3 text-xs text-mute">Amber = positive correlation · cyan = negative · trailing 252 trading days.</div>';
  document.getElementById('corr-matrix').innerHTML = html;
}

// ============ DEBASEMENT FRONT ============
function buildDebasement() {
  const d = CTX.debasement;
  const years = d.m2_series.map(p => p.year);
  const m2_idx  = d.m2_series.map(p => p.value / d.m2_series[0].value * 100);
  const debt_idx = d.debt_series.map(p => p.value / d.debt_series[0].value * 100);
  const cpi_idx  = d.cpi_series.map(p => p.value / d.cpi_series[0].value * 100);

  // Approximate gold and BTC indexed against 2015 from the price series for context
  const s = MARKET.series_weekly;
  const gold_for_years = [];
  const btc_for_years = [];
  for (const y of years) {
    const target = `${y}-01-01`;
    let idx = s.date.findIndex(dt => dt >= target);
    if (idx < 0) idx = s.date.length - 1;
    gold_for_years.push(s.xauusd[idx]);
    btc_for_years.push(s.btcusd[idx]);
  }
  const gold_idx = gold_for_years.map(v => v / gold_for_years[0] * 100);
  const btc_idx  = btc_for_years.map(v => v / btc_for_years[0] * 100);

  new Chart(document.getElementById('debasementChart').getContext('2d'), {
    type:'line', data:{ labels: years, datasets: [
      { label:'M2 money supply', data: m2_idx, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.05)', borderWidth:2, fill:false, pointRadius:2, tension:0.2 },
      { label:'US debt', data: debt_idx, borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.05)', borderWidth:2, fill:false, pointRadius:2, tension:0.2 },
      { label:'CPI', data: cpi_idx, borderColor:'#a8b3c0', backgroundColor:'rgba(168,179,192,0.05)', borderWidth:1.5, fill:false, pointRadius:2, tension:0.2, borderDash:[3,3] },
      { label:'Gold', data: gold_idx, borderColor:'#fde08a', borderWidth:2, fill:false, pointRadius:2, tension:0.2 },
      { label:'Bitcoin', data: btc_idx, borderColor:'#22d3ee', borderWidth:2, fill:false, pointRadius:2, tension:0.2 },
    ]},
    options: chartOpts({
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ color:'#a8b3c0', font:{family:'JetBrains Mono', size:10}, boxWidth:10 }},
        tooltip:{ callbacks:{ label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(0)}` }}
      },
      scales:{
        x:{ ticks:{ color:'#7a8694', font:{family:'JetBrains Mono'} }, grid:{display:false}, border:{color:'rgba(255,255,255,0.08)'}},
        y:{ type:'logarithmic', ticks:{ color:'#7a8694', callback:v=>v.toFixed(0)}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}}
      }
    })
  });
}

// ============ TIME MACHINE (WHAT-IF CALCULATOR) ============
let tmChartInstance;
function buildTimeMachine() {
  const amount = document.getElementById('tm-amount');
  const date   = document.getElementById('tm-date');
  const series = MARKET.series_weekly;

  // Set date min/max from available history
  date.min = series.date[0];
  date.max = series.date[series.date.length-1];

  // Preset handlers
  const presets = {
    'covid': '2020-03-20',
    'etf':   '2024-01-11',
    '5y':    addYears(MARKET.as_of, -5),
    '10y':   addYears(MARKET.as_of, -10),
  };
  document.querySelectorAll('.tm-preset').forEach(btn => btn.addEventListener('click', e => {
    const p = e.currentTarget.dataset.preset;
    let d = presets[p];
    if (d < series.date[0]) d = series.date[0];
    date.value = d;
    update();
  }));

  amount.addEventListener('input', update);
  date.addEventListener('change', update);

  function addYears(dateStr, n) {
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear()+n);
    return d.toISOString().slice(0,10);
  }

  function findIndex(target) {
    // find first weekly date >= target
    let idx = series.date.findIndex(d => d >= target);
    if (idx < 0) idx = series.date.length - 1;
    return idx;
  }

  function update() {
    const usd = Math.max(0, parseFloat(amount.value) || 0);
    const start = date.value || series.date[0];
    const i0 = findIndex(start);
    const iN = series.date.length - 1;
    const days = Math.round((new Date(series.date[iN]) - new Date(series.date[i0])) / 86400000);

    const p0 = { g:series.xauusd[i0], b:series.btcusd[i0], s:series.gspc[i0] };
    const pN = { g:series.xauusd[iN], b:series.btcusd[iN], s:series.gspc[iN] };

    // Buy at start prices, value at end prices
    const ozGold = usd / p0.g;
    const btcAmt = usd / p0.b;
    const spxAmt = usd / p0.s;

    const v = {
      g: ozGold * pN.g,
      b: btcAmt * pN.b,
      s: spxAmt * pN.s,
    };
    const r = {
      g: (v.g - usd) / usd * 100,
      b: (v.b - usd) / usd * 100,
      s: (v.s - usd) / usd * 100,
    };
    const m = { g: v.g/usd, b: v.b/usd, s: v.s/usd };

    document.getElementById('tm-gold-value').textContent = fmtUSD(v.g);
    document.getElementById('tm-btc-value').textContent  = fmtUSD(v.b);
    document.getElementById('tm-spx-value').textContent  = fmtUSD(v.s);

    setReturn('tm-gold-return', r.g);
    setReturn('tm-btc-return',  r.b);
    setReturn('tm-spx-return',  r.s);

    document.getElementById('tm-gold-multiplier').textContent = m.g.toFixed(2)+'×';
    document.getElementById('tm-btc-multiplier').textContent  = m.b.toFixed(2)+'×';
    document.getElementById('tm-spx-multiplier').textContent  = m.s.toFixed(2)+'×';

    document.getElementById('tm-gold-oz').textContent  = fmtNum(ozGold, 2) + ' oz @ ' + fmtUSD(p0.g) + '/oz';
    document.getElementById('tm-btc-amount').textContent = fmtNum(btcAmt, 4) + ' BTC @ ' + fmtUSD(p0.b);
    document.getElementById('tm-days').textContent = days.toLocaleString() + ' days';

    // Verdict
    const labels = {g:'Gold', b:'Bitcoin', s:'S&P 500'};
    const colors = {g:'text-goldhi', b:'', s:'text-cyan'};
    const cstyle = {g:'', b:'style="color:#ffb45a"', s:''};
    const sorted = [['g',r.g],['b',r.b],['s',r.s]].sort((a,b)=>b[1]-a[1]);
    const [w,sec,l] = sorted;
    const winnerLead = w[1] - sec[1];
    const verdict = document.getElementById('tm-verdict');
    verdict.innerHTML = `
      <div class="mb-2"><span class="${colors[w[0]]} font-semibold" ${cstyle[w[0]]}>${labels[w[0]]}</span> wins with <span class="mono ${w[1]>=0?'up':'down'}">${fmtPct(w[1])}</span></div>
      <div class="text-xs text-mute">${labels[w[0]]} beat ${labels[sec[0]]} by <span class="mono ${winnerLead>=0?'up':'down'}">${fmtPct(winnerLead)}</span> over ${days.toLocaleString()} days.</div>
      <div class="text-xs text-mute mt-1">${labels[l[0]]} trailed at <span class="mono ${l[1]>=0?'up':'down'}">${fmtPct(l[1])}</span>.</div>
    `;

    // Update label
    document.getElementById('tm-chart-label').textContent = `Growth of ${fmtUSD(usd)} from ${series.date[i0]} · weekly`;

    drawTmChart(i0, iN, usd, p0);
  }

  function setReturn(id, r) {
    const el = document.getElementById(id);
    el.textContent = fmtPct(r);
    el.className = r >= 0 ? 'up' : 'down';
  }

  function drawTmChart(i0, iN, usd, p0) {
    const dates = series.date.slice(i0);
    const gold = series.xauusd.slice(i0).map(p => p / p0.g * usd);
    const btc  = series.btcusd.slice(i0).map(p => p / p0.b * usd);
    const spx  = series.gspc.slice(i0).map(p => p / p0.s * usd);
    if (tmChartInstance) tmChartInstance.destroy();
    tmChartInstance = new Chart(document.getElementById('tmChart').getContext('2d'), {
      type:'line', data:{ labels: dates, datasets: [
        { label:'Gold', data: gold, borderColor:'#fde08a', borderWidth:2, fill:false, pointRadius:0, tension:0.2 },
        { label:'Bitcoin', data: btc, borderColor:'#22d3ee', borderWidth:2, fill:false, pointRadius:0, tension:0.2 },
        { label:'S&P 500', data: spx, borderColor:'#7a8694', borderWidth:1.5, borderDash:[4,3], fill:false, pointRadius:0, tension:0.2 },
      ]},
      options: chartOpts({
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ labels:{ color:'#a8b3c0', font:{family:'JetBrains Mono', size:11}, boxWidth:10 }},
          tooltip:{ callbacks:{ label: c => c.dataset.label + ': ' + fmtUSD(c.parsed.y) }}
        },
        scales:{
          x:{ ticks:{ color:'#7a8694', maxTicksLimit:8, maxRotation:0 }, grid:{display:false}, border:{color:'rgba(255,255,255,0.08)'}},
          y:{ type:'logarithmic', ticks:{ color:'#7a8694', callback:v=>fmtUSD(v)}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}}
        }
      })
    });
  }

  update();
}

// ============ EXCHANGE RATE PANEL ============
let ratioChartInstance;
function buildExchangePanel() {
  const g = MARKET.latest.xauusd;
  const b = MARKET.latest.btcusd;
  const ozPerBtc = b / g;
  const btcPerOz = g / b;
  const btcPerKg = btcPerOz * OZ_PER_KG;

  document.getElementById('btc-in-oz').textContent = fmtNum(ozPerBtc, 2);
  document.getElementById('oz-in-btc').textContent = fmtNum(btcPerOz, 5);
  document.getElementById('oz-in-sats').textContent = '· ' + Math.round(btcPerOz * SATS_PER_BTC).toLocaleString() + ' sats';
  document.getElementById('kg-in-btc').textContent = fmtNum(btcPerKg, 3);

  // Quick references
  document.getElementById('qr-london').textContent = fmtNum(ozPerBtc / 400, 4) + ' bars';
  document.getElementById('qr-kilo').textContent   = fmtNum(ozPerBtc / OZ_PER_KG, 4) + ' kg bars';
  document.getElementById('qr-eagle').textContent  = fmtNum(ozPerBtc, 2) + ' coins';
  // US gold reserves 8,133 tonnes → in BTC
  const usReservesOz = 8133 * OZ_PER_TONNE;
  const usReservesInBtc = usReservesOz * g / b;
  document.getElementById('qr-fortknox').textContent = fmtNum(usReservesInBtc / 1e6, 2) + 'M';

  // Ratio chart — build full weekly ratio series
  buildRatioSeries();
  drawRatioChart('10y');
  document.querySelectorAll('.ratio-btn').forEach(btn => btn.addEventListener('click', e => {
    document.querySelectorAll('.ratio-btn').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    drawRatioChart(e.currentTarget.dataset.ratioWindow);
  }));

  // Converter wiring
  const convBtc = document.getElementById('conv-btc');
  const convGold = document.getElementById('conv-gold');
  const convGoldUnit = document.getElementById('conv-gold-unit');
  function updateBtcSide() {
    const n = parseFloat(convBtc.value) || 0;
    const oz = n * ozPerBtc;
    document.getElementById('conv-btc-oz').textContent = fmtNum(oz, 2);
    document.getElementById('conv-btc-kg').textContent = fmtNum(oz / OZ_PER_KG, 3);
    document.getElementById('conv-btc-usd').textContent = fmtUSD(n * b);
  }
  function updateGoldSide() {
    const n = parseFloat(convGold.value) || 0;
    const unit = convGoldUnit.value;
    let oz = n;
    if (unit === 'g')  oz = n / G_PER_OZ;
    if (unit === 'kg') oz = n * OZ_PER_KG;
    const btc = oz * g / b;
    document.getElementById('conv-gold-btc').textContent = fmtNum(btc, 5);
    document.getElementById('conv-gold-sats').textContent = Math.round(btc * SATS_PER_BTC).toLocaleString();
    document.getElementById('conv-gold-usd').textContent = fmtUSD(oz * g);
  }
  convBtc.addEventListener('input', updateBtcSide);
  convGold.addEventListener('input', updateGoldSide);
  convGoldUnit.addEventListener('change', updateGoldSide);
  updateBtcSide(); updateGoldSide();
}

let RATIO_SERIES;
function buildRatioSeries() {
  const s = MARKET.series_weekly;
  RATIO_SERIES = {
    dates: s.date,
    values: s.btcusd.map((b,i) => b / s.xauusd[i])
  };
}

function drawRatioChart(win) {
  const today = new Date(MARKET.as_of);
  const cutoff = new Date(today);
  if (win === '1y') cutoff.setFullYear(cutoff.getFullYear()-1);
  else if (win === '5y') cutoff.setFullYear(cutoff.getFullYear()-5);
  else cutoff.setFullYear(cutoff.getFullYear()-10);

  const i0 = RATIO_SERIES.dates.findIndex(d => new Date(d) >= cutoff);
  const dates = RATIO_SERIES.dates.slice(i0);
  const vals  = RATIO_SERIES.values.slice(i0);

  // stats over the entire weekly series (not just window)
  const allVals = RATIO_SERIES.values;
  const peak = Math.max(...allVals);
  const low  = Math.min(...allVals);
  const peakIdx = allVals.indexOf(peak);
  const lowIdx  = allVals.indexOf(low);
  const fiveYrStart = Math.max(0, allVals.length - 260);
  const avg5y = allVals.slice(fiveYrStart).reduce((a,b)=>a+b,0) / (allVals.length - fiveYrStart);
  const current = allVals[allVals.length-1];
  const diff = (current - avg5y) / avg5y * 100;

  document.getElementById('ratio-peak').innerHTML = `${fmtNum(peak,1)} oz <span class="text-mute text-[10px]">${RATIO_SERIES.dates[peakIdx]}</span>`;
  document.getElementById('ratio-low').innerHTML  = `${fmtNum(low,1)} oz <span class="text-mute text-[10px]">${RATIO_SERIES.dates[lowIdx]}</span>`;
  document.getElementById('ratio-vs-avg').innerHTML = `<span class="${diff>=0?'up':'down'}">${diff>=0?'+':''}${diff.toFixed(1)}%</span>`;

  if (ratioChartInstance) ratioChartInstance.destroy();
  ratioChartInstance = new Chart(document.getElementById('ratioChart').getContext('2d'), {
    type:'line',
    data:{ labels: dates, datasets: [{
      label:'oz of gold per BTC', data: vals,
      borderColor:'#22d3ee', backgroundColor:'rgba(34,211,238,0.10)',
      borderWidth:2, fill:true, pointRadius:0, tension:0.2
    }]},
    options: chartOpts({
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label: c => `${c.parsed.y.toFixed(2)} oz of gold` } }
      },
      scales: {
        x:{ ticks:{ color:'#7a8694', maxTicksLimit:6, maxRotation:0 }, grid:{display:false}, border:{color:'rgba(255,255,255,0.08)'}},
        y:{ ticks:{ color:'#7a8694', callback:v=>v.toFixed(0)+' oz'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}}
      }
    })
  });
}

function buildScoreboard() {
  let sumGold = 0, sumBtc = 0;
  const html = CTX.scoreboard.map(row => {
    sumGold += row.gold_score; sumBtc += row.btc_score;
    const verdict = row.gold_score === row.btc_score ? '<span class="verdict-tag verdict-tie">Tie</span>'
      : row.gold_score > row.btc_score ? '<span class="verdict-tag verdict-gold">Gold</span>'
      : '<span class="verdict-tag verdict-btc">BTC</span>';
    return `<details class="scoreboard-row py-3">
      <summary class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
        <span class="text-sm">${row.metric}</span>
        <span class="mono text-sm text-goldhi w-10 text-right">${row.gold_score}</span>
        <span class="mono text-sm w-10 text-right" style="color:#ffb45a">${row.btc_score}</span>
        <span class="w-14 text-right">${verdict}</span>
      </summary>
      <div class="mt-3 grid md:grid-cols-2 gap-3 text-xs text-mute pl-1">
        <div class="border-l-2 border-gold/40 pl-3">${row.gold_note}</div>
        <div class="border-l-2 pl-3" style="border-color:rgba(247,147,26,0.4)">${row.btc_note}</div>
      </div>
    </details>`;
  }).join('');
  document.getElementById('scoreboard').innerHTML = html;
  const max = CTX.scoreboard.length * 10;
  document.getElementById('score-gold').textContent = sumGold + '/' + max;
  document.getElementById('score-btc').textContent  = sumBtc + '/' + max;
  document.getElementById('bar-gold').style.width = (sumGold/max*100) + '%';
  document.getElementById('bar-btc').style.width  = (sumBtc/max*100) + '%';
}

function buildList(id, items, color) {
  const dot = color==='gold' ? 'bg-gold' : color==='btc' ? 'bg-btc' : 'bg-mute';
  document.getElementById(id).innerHTML = items.map(t =>
    `<li class="flex items-start gap-3"><span class="inline-block w-1.5 h-1.5 ${dot} mt-2 flex-shrink-0"></span><span>${t}</span></li>`
  ).join('');
}

// ============ PRICE CHART ============
let priceChartInstance;
function refreshPrice() {
  const win = document.querySelector('.window-btn.active').dataset.window;
  const mode = document.querySelector('.mode-btn.active').dataset.mode;
  const regimes = document.getElementById('show-regimes').checked;
  drawPriceChart(win, mode, regimes);
}

function drawPriceChart(win, mode, showRegimes) {
  const series = MARKET.series_weekly;
  // window cut
  const today = new Date(MARKET.as_of);
  const cutoff = new Date(today);
  if (win === '1y') cutoff.setFullYear(cutoff.getFullYear()-1);
  else if (win === '5y') cutoff.setFullYear(cutoff.getFullYear()-5);
  else cutoff.setFullYear(cutoff.getFullYear()-10);

  const idx0 = series.date.findIndex(d => new Date(d) >= cutoff);
  const dates = series.date.slice(idx0);
  let gold = series.xauusd.slice(idx0);
  let btc  = series.btcusd.slice(idx0);

  let datasets = [];
  let yAxes = {};
  if (mode === 'normalized') {
    const g0 = gold[0], b0 = btc[0];
    gold = gold.map(v => v / g0 * 100);
    btc  = btc.map(v => v / b0 * 100);
    datasets = [
      { label:'Gold (indexed)', data: gold, borderColor:'#fde08a', backgroundColor:'rgba(253,224,138,0.08)', borderWidth:2.5, fill:false, pointRadius:0, tension:0.2, yAxisID:'y' },
      { label:'Bitcoin (indexed)', data: btc, borderColor:'#22d3ee', backgroundColor:'rgba(34,211,238,0.08)', borderWidth:2.5, fill:false, pointRadius:0, tension:0.2, yAxisID:'y' },
    ];
    yAxes = { y:{ type:'logarithmic', ticks:{ color:'#7a8694', callback:v=>v}, grid:{ color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}} };
  } else if (mode === 'absolute') {
    datasets = [
      { label:'Gold ($/oz)', data: gold, borderColor:'#fde08a', borderWidth:2.5, fill:false, pointRadius:0, tension:0.2, yAxisID:'yG' },
      { label:'BTC ($)', data: btc, borderColor:'#22d3ee', borderWidth:2.5, fill:false, pointRadius:0, tension:0.2, yAxisID:'yB' },
    ];
    yAxes = {
      yG:{ position:'left', ticks:{ color:'#fde08a', callback:v=>'$'+v.toLocaleString()}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(245,185,69,0.3)'}},
      yB:{ position:'right', ticks:{ color:'#22d3ee', callback:v=>'$'+(v/1000).toFixed(0)+'k'}, grid:{display:false}, border:{color:'rgba(34,211,238,0.3)'}}
    };
  } else {
    // ratio btc / gold (oz per BTC)
    const ratio = btc.map((b,i) => b / gold[i]);
    datasets = [{ label:'BTC ÷ Gold (oz)', data: ratio, borderColor:'#22d3ee', backgroundColor:'rgba(34,211,238,0.08)', borderWidth:2, fill:true, pointRadius:0, tension:0.2 }];
    yAxes = { y:{ ticks:{ color:'#7a8694', callback:v=>v.toFixed(1)+' oz'}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.08)'}} };
  }

  const annotations = {};
  if (showRegimes) {
    CTX.regimes.forEach((r, i) => {
      if (new Date(r.date) < cutoff) return;
      const xIdx = dates.findIndex(d => d >= r.date);
      if (xIdx < 0) return;
      annotations['l'+i] = {
        type:'line', xMin: dates[xIdx], xMax: dates[xIdx],
        borderColor: r.type==='gold'?'#f5b945':r.type==='btc'?'#f7931a':'#22d3ee',
        borderWidth: 1, borderDash:[3,3],
        label:{ display:true, content:r.label, position:'start', backgroundColor:'rgba(13,17,22,0.85)', color:'#e3e9f0', font:{family:'JetBrains Mono',size:9}, padding:4 }
      };
    });
  }

  if (priceChartInstance) priceChartInstance.destroy();
  priceChartInstance = new Chart(document.getElementById('priceChart').getContext('2d'), {
    type:'line', data:{ labels: dates, datasets },
    options: chartOpts({
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ color:'#a8b3c0', font:{family:'JetBrains Mono', size:11}, boxWidth:10 }},
        tooltip:{ callbacks:{ label: c => {
          if (mode==='absolute') return c.dataset.label + ': $' + c.parsed.y.toLocaleString('en-US',{maximumFractionDigits:0});
          if (mode==='ratio') return c.dataset.label + ': ' + c.parsed.y.toFixed(2) + ' oz';
          return c.dataset.label + ': ' + c.parsed.y.toFixed(1);
        } }},
        annotation:{ annotations }
      },
      scales: { x:{ ticks:{ color:'#7a8694', maxTicksLimit:8, maxRotation:0 }, grid:{display:false}, border:{color:'rgba(255,255,255,0.08)'}}, ...yAxes }
    })
  });
}

function chartOpts(extra={}) {
  return Object.assign({
    responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
  }, extra);
}

// ============ HALVING COUNTDOWN ============
function startHalvingCountdown() {
  const target = new Date('2028-03-26T19:02:35Z');
  const el = document.getElementById('halving-countdown');
  function tick() {
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) { el.textContent = 'In progress'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff % 86400000 / 3600000);
    const m = Math.floor(diff % 3600000 / 60000);
    el.textContent = `${d}d ${h}h ${m}m`;
  }
  tick(); setInterval(tick, 60000);
}

// ============ ALLOCATION SIMULATOR ============
function updateSim() {
  const gPct = parseFloat(document.getElementById('gold-slider').value);
  const bPct = parseFloat(document.getElementById('btc-slider').value);
  document.getElementById('gold-w').textContent = gPct.toFixed(1) + '%';
  document.getElementById('btc-w').textContent  = bPct.toFixed(1) + '%';
  const NW = CTX.households.us_household_net_worth_usd;
  const currentGold = CTX.households.gold_held_by_us_households_estimate_usd;
  const currentBtc  = CTX.valuation_metrics.bitcoin_market_cap_usd * 0.25; // ~US share
  const goldTarget = NW * gPct/100;
  const btcTarget = NW * bPct/100;
  document.getElementById('sim-gold').textContent = fmtUSD(Math.max(0, goldTarget - currentGold)) + ' needed';
  document.getElementById('sim-btc').textContent  = fmtUSD(Math.max(0, btcTarget - currentBtc)) + ' needed';
  // tonnes equivalent of new gold inflow at current price
  const newGold = Math.max(0, goldTarget - currentGold);
  const ozNeeded = newGold / MARKET.latest.xauusd;
  const tonnesNeeded = ozNeeded / 32150.7;
  const pctOfAboveGround = tonnesNeeded / CTX.supply.gold.above_ground_tonnes * 100;
  document.getElementById('sim-pctgold').textContent = pctOfAboveGround.toFixed(2) + '%';
}

// ============ SNAPSHOT CARDS ============
function openSnapshot(kind) {
  const canvas = document.getElementById('snap-canvas');
  drawSnapshot(canvas, kind);
  document.getElementById('snap-overlay').style.display = 'flex';
}

function drawSnapshot(canvas, kind) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // bg
  ctx.fillStyle = '#0a0d11'; ctx.fillRect(0,0,W,H);
  // grid lines
  ctx.strokeStyle = 'rgba(245,185,69,0.06)'; ctx.lineWidth = 1;
  for (let x=0; x<W; x+=48) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<H; y+=48) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  // corner brackets
  ctx.strokeStyle = '#f5b945'; ctx.lineWidth = 3;
  drawBracket(ctx, 30, 30, 'tl'); drawBracket(ctx, W-30, 30, 'tr');
  drawBracket(ctx, 30, H-30, 'bl'); drawBracket(ctx, W-30, H-30, 'br');

  // header
  ctx.fillStyle = '#7a8694'; ctx.font = '14px JetBrains Mono'; ctx.textAlign = 'left';
  ctx.fillText('WAR ROOM · SECTION 04 / STORE OF VALUE', 70, 80);
  ctx.fillStyle = '#22d3ee'; ctx.fillText('● LIVE  ' + MARKET.as_of, W-260, 80);

  // title varies
  const titles = {
    price: 'Gold vs Bitcoin · Price Theater',
    supply: 'Gold vs Bitcoin · Supply Doctrine',
    exchange: 'One Bitcoin Buys ' + fmtNum(MARKET.latest.btcusd / MARKET.latest.xauusd, 1) + ' oz of Gold',
    timemachine: 'Time Machine · What If You Had Bought Then?',
    debasement: 'The Dollar Has Lost 29% Since 2015',
    vaults: 'Central Banks Bought 863t of Gold in 2025',
    households: 'Where $175.3T of US Wealth Sits',
    vol: 'Risk Profile · Volatility & Correlation',
    scoreboard: 'Twelve Criteria. One Verdict.'
  };
  ctx.fillStyle = '#fde08a'; ctx.font = 'bold 44px Space Grotesk';
  wrapText(ctx, titles[kind], 70, 140, W-140, 52);

  // panel-specific body
  if (kind === 'price') drawPriceCard(ctx, W, H);
  else if (kind === 'supply') drawSupplyCard(ctx, W, H);
  else if (kind === 'exchange') drawExchangeCard(ctx, W, H);
  else if (kind === 'timemachine') drawTimeMachineCard(ctx, W, H);
  else if (kind === 'debasement') drawDebasementCard(ctx, W, H);
  else if (kind === 'vaults') drawVaultsCard(ctx, W, H);
  else if (kind === 'households') drawHHCard(ctx, W, H);
  else if (kind === 'vol') drawVolCard(ctx, W, H);
  else if (kind === 'scoreboard') drawScoreCard(ctx, W, H);

  // footer
  ctx.fillStyle = '#7a8694'; ctx.font = '12px JetBrains Mono';
  ctx.fillText('SOURCES: WORLD GOLD COUNCIL · FRED · BITBO · PERPLEXITY FINANCE', 70, H-50);
  ctx.fillStyle = '#f5b945'; ctx.fillText('warroom.pplx', W-150, H-50);
}

function drawBracket(ctx, x, y, corner) {
  const len = 22;
  ctx.beginPath();
  if (corner === 'tl') { ctx.moveTo(x, y+len); ctx.lineTo(x,y); ctx.lineTo(x+len,y); }
  if (corner === 'tr') { ctx.moveTo(x-len, y); ctx.lineTo(x,y); ctx.lineTo(x,y+len); }
  if (corner === 'bl') { ctx.moveTo(x, y-len); ctx.lineTo(x,y); ctx.lineTo(x+len,y); }
  if (corner === 'br') { ctx.moveTo(x-len, y); ctx.lineTo(x,y); ctx.lineTo(x,y-len); }
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w + ' '; y += lineH; }
    else line = test;
  }
  ctx.fillText(line, x, y);
}

function drawPriceCard(ctx, W, H) {
  // two big stat tiles
  drawStatTile(ctx, 70, 240, 'GOLD · XAU/USD', fmtPrice(MARKET.latest.xauusd), '#fde08a',
    `1Y ${fmtPct(MARKET.returns['1y'].xauusd)}   ·   5Y ${fmtPct(MARKET.returns['5y'].xauusd)}   ·   10Y ${fmtPct(MARKET.returns['10y'].xauusd)}`);
  drawStatTile(ctx, 620, 240, 'BITCOIN · BTC/USD', fmtPrice(MARKET.latest.btcusd), '#ffb45a',
    `1Y ${fmtPct(MARKET.returns['1y'].btcusd)}   ·   5Y ${fmtPct(MARKET.returns['5y'].btcusd)}   ·   10Y ${fmtPct(MARKET.returns['10y'].btcusd)}`);

  // mini line for last 5y indexed
  const s = MARKET.series_weekly;
  const i0 = s.date.length - 260;
  drawMiniChart(ctx, 70, 410, 1060, 130, s.date.slice(i0), s.xauusd.slice(i0), s.btcusd.slice(i0));
}

function drawStatTile(ctx, x, y, label, value, color, sub) {
  ctx.fillStyle = '#0e1318'; ctx.fillRect(x, y, 510, 130);
  ctx.fillStyle = color; ctx.fillRect(x, y, 4, 130);
  ctx.fillStyle = '#7a8694'; ctx.font = '12px JetBrains Mono'; ctx.fillText(label, x+24, y+30);
  ctx.fillStyle = color; ctx.font = 'bold 44px JetBrains Mono'; ctx.fillText(value, x+24, y+82);
  ctx.fillStyle = '#a8b3c0'; ctx.font = '14px JetBrains Mono'; ctx.fillText(sub, x+24, y+112);
}

function drawMiniChart(ctx, x, y, w, h, dates, gold, btc) {
  ctx.fillStyle = '#0d1318'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeRect(x,y,w,h);
  const g0 = gold[0], b0 = btc[0];
  const gN = gold.map(v => v/g0*100); const bN = btc.map(v => v/b0*100);
  const allMax = Math.max(...gN, ...bN); const allMin = Math.min(...gN, ...bN);
  const sx = i => x + 10 + i/(dates.length-1) * (w-20);
  const sy = v => y + h - 10 - (v-allMin)/(allMax-allMin) * (h-20);
  // gold
  ctx.strokeStyle = '#fde08a'; ctx.lineWidth = 2.5; ctx.beginPath();
  gN.forEach((v,i) => i===0 ? ctx.moveTo(sx(i),sy(v)) : ctx.lineTo(sx(i),sy(v)));
  ctx.stroke();
  // btc
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
  bN.forEach((v,i) => i===0 ? ctx.moveTo(sx(i),sy(v)) : ctx.lineTo(sx(i),sy(v)));
  ctx.stroke();
  // legend
  ctx.font = '12px JetBrains Mono';
  ctx.fillStyle = '#fde08a'; ctx.fillText('— Gold (indexed 100)', x+12, y+22);
  ctx.fillStyle = '#22d3ee'; ctx.fillText('— Bitcoin (indexed 100)', x+200, y+22);
}

function drawExchangeCard(ctx, W, H) {
  const g = MARKET.latest.xauusd;
  const b = MARKET.latest.btcusd;
  const ozPerBtc = b / g;
  const btcPerOz = g / b;
  const btcPerKg = btcPerOz * OZ_PER_KG;

  // Three big tiles
  drawStatTile(ctx, 70, 240, '1 BTC BUYS', fmtNum(ozPerBtc, 2) + ' oz', '#ffb45a', 'troy ounces of gold');
  drawStatTile(ctx, 620, 240, '1 oz OF GOLD BUYS', fmtNum(btcPerOz, 4) + ' BTC', '#fde08a', Math.round(btcPerOz * SATS_PER_BTC).toLocaleString() + ' satoshis');

  // Quick reference list bottom
  ctx.fillStyle = '#0e1318'; ctx.fillRect(70, 400, 1060, 150);
  ctx.fillStyle = '#22d3ee'; ctx.fillRect(70, 400, 4, 150);
  ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText('AT TODAY\'S RATES, 1 BTC GETS YOU', 94, 430);
  ctx.font = 'bold 20px Space Grotesk'; ctx.fillStyle = '#e3e9f0';
  ctx.fillText(`${fmtNum(ozPerBtc / OZ_PER_KG, 3)} kilo gold bars`, 94, 470);
  ctx.fillText(`${fmtNum(ozPerBtc, 1)} American Gold Eagles (1 oz each)`, 94, 505);
  ctx.fillText(`${fmtNum(ozPerBtc / 400, 4)} London Good Delivery bars (400 oz)`, 94, 540);
}

function drawDebasementCard(ctx, W, H) {
  // Three big stat tiles
  drawStatTile(ctx, 70,  240, 'M2 MONEY SUPPLY',     '$22.7T', '#ef4444', '+93% since 2015');
  drawStatTile(ctx, 620, 240, 'US NATIONAL DEBT',    '$39.0T', '#ef4444', '+116% since 2015');

  // Purchasing power highlight
  ctx.fillStyle = '#0e1318'; ctx.fillRect(70, 400, 1060, 150);
  ctx.fillStyle = '#ef4444'; ctx.fillRect(70, 400, 4, 150);
  ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText('PURCHASING POWER OF $1 (2015 DOLLARS)', 94, 430);
  ctx.fillStyle = '#ef4444'; ctx.font = 'bold 64px JetBrains Mono'; ctx.fillText('$0.71', 94, 495);
  ctx.fillStyle = '#a8b3c0'; ctx.font = '14px Space Grotesk';
  ctx.fillText('Over the same period, gold returned +138% (2.4×) and Bitcoin returned +16,822% (168×).', 280, 480);
  ctx.fillText('The dollar lost 29% of its value. Both stores of value gained ground.', 280, 510);
  ctx.fillText('CPI inflation +3.8% YoY · +40% cumulative since 2015.', 280, 535);
}

function drawTimeMachineCard(ctx, W, H) {
  const usd = parseFloat(document.getElementById('tm-amount').value) || 10000;
  const startDate = document.getElementById('tm-date').value;
  const series = MARKET.series_weekly;
  let i0 = series.date.findIndex(d => d >= startDate);
  if (i0 < 0) i0 = 0;
  const iN = series.date.length - 1;
  const p0 = { g:series.xauusd[i0], b:series.btcusd[i0], s:series.gspc[i0] };
  const pN = { g:series.xauusd[iN], b:series.btcusd[iN], s:series.gspc[iN] };
  const v = { g: usd/p0.g*pN.g, b: usd/p0.b*pN.b, s: usd/p0.s*pN.s };
  const r = { g: (v.g-usd)/usd*100, b: (v.b-usd)/usd*100, s: (v.s-usd)/usd*100 };

  // Subtitle
  ctx.fillStyle = '#7a8694'; ctx.font = '15px JetBrains Mono';
  ctx.fillText(`${fmtUSD(usd)} invested on ${series.date[i0]} would be worth today:`, 70, 215);

  // Three tiles
  drawStatTile(ctx, 70,  250, 'GOLD',    fmtUSD(v.g), '#fde08a', `${(r.g>=0?'+':'')}${r.g.toFixed(1)}% · ${(v.g/usd).toFixed(2)}×`);
  drawStatTile(ctx, 620, 250, 'BITCOIN', fmtUSD(v.b), '#ffb45a', `${(r.b>=0?'+':'')}${r.b.toFixed(1)}% · ${(v.b/usd).toFixed(2)}×`);

  // S&P bottom strip + verdict
  ctx.fillStyle = '#0e1318'; ctx.fillRect(70, 400, 1060, 150);
  ctx.fillStyle = '#22d3ee'; ctx.fillRect(70, 400, 4, 150);
  ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono';
  ctx.fillText(`S&P 500 BENCHMARK: ${fmtUSD(v.s)} · ${(r.s>=0?'+':'')}${r.s.toFixed(1)}%`, 94, 432);

  // Winner
  const sorted = [['Gold', r.g, '#fde08a'],['Bitcoin', r.b, '#ffb45a'],['S&P 500', r.s, '#22d3ee']].sort((a,b)=>b[1]-a[1]);
  const w = sorted[0];
  ctx.font = 'bold 28px Space Grotesk'; ctx.fillStyle = w[2];
  ctx.fillText(`Winner: ${w[0]} · ${(w[1]>=0?'+':'')}${w[1].toFixed(1)}%`, 94, 475);
  ctx.font = '14px Space Grotesk'; ctx.fillStyle = '#a8b3c0';
  const lead = w[1] - sorted[1][1];
  const days = Math.round((new Date(series.date[iN]) - new Date(series.date[i0])) / 86400000);
  ctx.fillText(`Beat ${sorted[1][0]} by ${lead.toFixed(1)}% over ${days.toLocaleString()} days`, 94, 505);
  ctx.fillText(`${sorted[2][0]} trailed at ${(sorted[2][1]>=0?'+':'')}${sorted[2][1].toFixed(1)}%`, 94, 530);
}

function drawSupplyCard(ctx, W, H) {
  // two columns
  drawSupplyCol(ctx, 70, 230, 'GOLD', '#fde08a', [
    ['Above-ground', '219,891 t'],
    ['Annual supply', '+1.67% / yr'],
    ['Stock-to-flow', '59.9'],
    ['Mined of total', '~100%']
  ]);
  drawSupplyCol(ctx, 620, 230, 'BITCOIN', '#ffb45a', [
    ['Circulating', '19.92M / 21M'],
    ['Annual supply', '+0.82% / yr'],
    ['Stock-to-flow', '121.3'],
    ['Mined of total', '94.86%']
  ]);
  // verdict
  ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 22px Space Grotesk';
  ctx.fillText('Bitcoin\'s stock-to-flow is 2× gold.', 70, H-110);
  ctx.fillStyle = '#a8b3c0'; ctx.font = '16px Space Grotesk';
  ctx.fillText('The hard cap is what no other monetary asset has.', 70, H-85);
}

function drawSupplyCol(ctx, x, y, title, color, rows) {
  ctx.fillStyle = '#0e1318'; ctx.fillRect(x, y, 510, 280);
  ctx.fillStyle = color; ctx.fillRect(x, y, 4, 280);
  ctx.fillStyle = color; ctx.font = 'bold 28px Space Grotesk'; ctx.fillText(title, x+24, y+42);
  rows.forEach((r, i) => {
    const ry = y + 90 + i*50;
    ctx.fillStyle = '#7a8694'; ctx.font = '12px JetBrains Mono'; ctx.fillText(r[0].toUpperCase(), x+24, ry);
    ctx.fillStyle = '#e3e9f0'; ctx.font = 'bold 24px JetBrains Mono'; ctx.fillText(r[1], x+24, ry+28);
  });
}

function drawVaultsCard(ctx, W, H) {
  const top = CTX.central_banks.top_holders.slice(0,10);
  const max = top[0].tonnes;
  top.forEach((h, i) => {
    const ry = 230 + i*32;
    ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText(h.code, 70, ry+15);
    ctx.fillStyle = '#e3e9f0'; ctx.font = '15px Space Grotesk'; ctx.fillText(h.country, 120, ry+15);
    const barW = (h.tonnes/max) * 600;
    ctx.fillStyle = 'rgba(245,185,69,0.18)'; ctx.fillRect(360, ry+2, 600, 22);
    ctx.fillStyle = '#f5b945'; ctx.fillRect(360, ry+2, barW, 22);
    ctx.fillStyle = '#fde08a'; ctx.font = 'bold 14px JetBrains Mono'; ctx.textAlign='right';
    ctx.fillText(h.tonnes.toLocaleString()+'t', 1130, ry+19); ctx.textAlign='left';
  });
}

function drawHHCard(ctx, W, H) {
  ctx.fillStyle = '#7a8694'; ctx.font = '14px JetBrains Mono';
  ctx.fillText('Federal Reserve Z.1 · Q4 2025', 70, 220);

  // big stat
  ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 88px JetBrains Mono'; ctx.fillText('$175.3T', 70, 320);
  ctx.fillStyle = '#a8b3c0'; ctx.font = '18px Space Grotesk'; ctx.fillText('total US household net worth', 70, 350);

  // bars
  const bars = [
    { label:'Real estate, equities, bonds, cash', pct:98.3, color:'#475569' },
    { label:'Bitcoin (US share)', pct:0.88, color:'#f7931a' },
    { label:'Gold (private holdings)', pct:0.83, color:'#f5b945' },
  ];
  bars.forEach((b, i) => {
    const y = 410 + i*55;
    ctx.fillStyle = '#a8b3c0'; ctx.font = '14px Space Grotesk'; ctx.fillText(b.label, 70, y);
    ctx.fillStyle = b.color; ctx.font = 'bold 14px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(b.pct + '%', 1130, y); ctx.textAlign='left';
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(70, y+8, 1060, 14);
    ctx.fillStyle = b.color; ctx.fillRect(70, y+8, Math.max(2, (b.pct/100)*1060), 14);
  });
}

function drawVolCard(ctx, W, H) {
  const rows = [
    ['Gold 1Y vol', MARKET.volatility['1y'].xauusd.toFixed(1)+'%', '#fde08a'],
    ['BTC 1Y vol',  MARKET.volatility['1y'].btcusd.toFixed(1)+'%', '#ffb45a'],
    ['Gold 5Y max DD', MARKET.max_drawdown_5y.xauusd.toFixed(1)+'%', '#fde08a'],
    ['BTC 5Y max DD',  MARKET.max_drawdown_5y.btcusd.toFixed(1)+'%', '#ffb45a'],
    ['Gold·BTC correlation', MARKET.correlations_1y.xauusd.btcusd.toFixed(2), '#22d3ee'],
    ['Gold·DXY correlation', MARKET.correlations_1y.xauusd.dxy.toFixed(2), '#22d3ee'],
  ];
  rows.forEach((r, i) => {
    const x = 70 + (i%2)*545; const y = 230 + Math.floor(i/2)*135;
    ctx.fillStyle = '#0e1318'; ctx.fillRect(x, y, 510, 115);
    ctx.fillStyle = r[2]; ctx.fillRect(x, y, 4, 115);
    ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText(r[0].toUpperCase(), x+24, y+30);
    ctx.fillStyle = r[2]; ctx.font = 'bold 42px JetBrains Mono'; ctx.fillText(r[1], x+24, y+80);
  });
}

function drawScoreCard(ctx, W, H) {
  let sumG = 0, sumB = 0;
  CTX.scoreboard.forEach(r => { sumG += r.gold_score; sumB += r.btc_score; });
  const max = CTX.scoreboard.length * 10;

  ctx.fillStyle = '#0e1318'; ctx.fillRect(70, 230, 510, 320);
  ctx.fillStyle = '#fde08a'; ctx.fillRect(70, 230, 4, 320);
  ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText('TOTAL · GOLD', 94, 260);
  ctx.fillStyle = '#fde08a'; ctx.font = 'bold 108px JetBrains Mono'; ctx.fillText(sumG, 94, 380);
  ctx.fillStyle = '#7a8694'; ctx.font = '16px JetBrains Mono'; ctx.fillText('/ ' + max, 94, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(94, 470, 462, 14);
  ctx.fillStyle = '#fde08a'; ctx.fillRect(94, 470, (sumG/max)*462, 14);

  ctx.fillStyle = '#0e1318'; ctx.fillRect(620, 230, 510, 320);
  ctx.fillStyle = '#ffb45a'; ctx.fillRect(620, 230, 4, 320);
  ctx.fillStyle = '#7a8694'; ctx.font = '13px JetBrains Mono'; ctx.fillText('TOTAL · BITCOIN', 644, 260);
  ctx.fillStyle = '#ffb45a'; ctx.font = 'bold 108px JetBrains Mono'; ctx.fillText(sumB, 644, 380);
  ctx.fillStyle = '#7a8694'; ctx.font = '16px JetBrains Mono'; ctx.fillText('/ ' + max, 644, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(644, 470, 462, 14);
  ctx.fillStyle = '#ffb45a'; ctx.fillRect(644, 470, (sumB/max)*462, 14);
}

function downloadSnapshot() {
  const canvas = document.getElementById('snap-canvas');
  const link = document.createElement('a');
  link.download = 'warroom-snapshot.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Chart.js annotation plugin shim — register inline if loaded later
// Light-weight: we draw regime lines via plugin if available, else fall back to nothing.
// We'll skip annotation plugin and just use vertical lines via custom plugin.

bootstrap();
