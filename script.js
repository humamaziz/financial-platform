/* script.js - full interactions for FinServe demo (flat files)
   - navbar toggle
   - demo datastore in localStorage
   - seed / reset demo data
   - accounts rendering, transfers, transactions filtering
   - CSV export
   - EMI & investment calculators with canvas chart
   - NEW: Balance tracker (account.html) starting from ₹0, deposit/expense history
*/

document.addEventListener('DOMContentLoaded', () => {
  /* NAV toggle */
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const ul = mainNav.querySelector('ul');
      if (!ul) return;
      ul.classList.toggle('show');
    });
  }

  /* STORAGE KEY & SAMPLE state
     Note: per your request, starting balances are zero.
  */
  const KEY = 'finserve_demo_v2_flat';
  const SAMPLE = {
    accounts: [
      { id: 'acc_chk', name: 'Checking Account', type: 'checking', balance: 0 },
      { id: 'acc_sav', name: 'Savings Account', type: 'savings', balance: 0 },
      { id: 'acc_inv', name: 'Investments', type: 'investments', balance: 0 }
    ],
    transactions: [
      // start empty so you update as you need
    ],
    balanceHistory: [
      // for account.html, start with initial balance record
      // each item: {id, date, type: 'deposit'|'expense', desc, amount, balanceAfter}
    ]
  };

  function loadState(){
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(SAMPLE));
    } catch (e) {
      return JSON.parse(JSON.stringify(SAMPLE));
    }
  }
  function saveState(s){ localStorage.setItem(KEY, JSON.stringify(s)); }

  let state = loadState();

  /* UTIL */
  function uid(prefix='id'){ return prefix + '_' + Date.now() + Math.floor(Math.random()*99); }
  function formatINR(n){ return '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:2}); }
  function shortDate(iso){ const d = new Date(iso); return d.toLocaleString(); }

  /* === ACCOUNTS & TRANSACTIONS (used on multiple pages) === */
  function renderAccountsList(){
    const el = document.getElementById('accountsList');
    if(!el) return;
    el.innerHTML = '';
    state.accounts.forEach(acc => {
      const node = document.createElement('div');
      node.className = 'card';
      node.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${acc.name}</strong>
          <div class="muted small">${acc.type}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800">${formatINR(acc.balance)}</div>
        </div>
      </div>`;
      el.appendChild(node);
    });
  }

  function renderAccountSelects(){
    ['fromAcc','toAcc','filterAcc'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.innerHTML = '';
      state.accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.name} — ${formatINR(a.balance)}`;
        el.appendChild(opt);
      });
    });
  }

  function renderOverview(){
    const total = state.accounts.reduce((s,a)=>s+a.balance,0);
    const savings = state.accounts.filter(a=>a.type==='savings').reduce((s,a)=>s+a.balance,0);
    const inv = state.accounts.filter(a=>a.type==='investments').reduce((s,a)=>s+a.balance,0);
    const eTotal = document.getElementById('totalBalance');
    const eSav = document.getElementById('savingsBalance');
    const eInv = document.getElementById('investBalance');
    if(eTotal) eTotal.textContent = formatINR(total);
    if(eSav) eSav.textContent = formatINR(savings);
    if(eInv) eInv.textContent = formatINR(inv);
  }

  function renderTransactions(){
    const tbody = document.getElementById('txBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const filterType = document.getElementById('typeFilter')?.value || 'all';
    const filterAcc = document.getElementById('filterAcc')?.value || '';
    const q = (document.getElementById('searchTx')?.value || '').toLowerCase();
    const txs = state.transactions.slice().sort((a,b)=> new Date(b.date)-new Date(a.date));
    txs.forEach(tx => {
      if(filterType !== 'all' && tx.type !== filterType) return;
      if(filterAcc && tx.accountId !== filterAcc) return;
      if(q && !tx.desc.toLowerCase().includes(q)) return;
      const acc = state.accounts.find(a=>a.id===tx.accountId) || {name:'—'};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${shortDate(tx.date)}</td><td>${acc.name}</td><td>${tx.desc}</td><td class="${tx.type}">${tx.type}</td><td style="font-weight:800">${formatINR(tx.amount)}</td>`;
      tbody.appendChild(tr);
    });
  }

  /* Transfer flow (dashboard) */
  const doTransferBtn = document.getElementById('doTransfer');
  if(doTransferBtn){
    doTransferBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const fromId = document.getElementById('fromAcc').value;
      const toId = document.getElementById('toAcc').value;
      const amt = parseFloat(document.getElementById('transferAmt').value || '0');
      const msgEl = document.getElementById('transferMsg');
      if(!fromId || !toId || fromId === toId){ if(msgEl) msgEl.textContent = 'Select two different accounts'; return; }
      if(!amt || amt <= 0){ if(msgEl) msgEl.textContent = 'Enter a valid amount'; return; }
      const from = state.accounts.find(a=>a.id===fromId);
      const to = state.accounts.find(a=>a.id===toId);
      if(!from || !to){ if(msgEl) msgEl.textContent = 'Account not found'; return; }
      if(from.balance < amt){ if(msgEl) msgEl.textContent = 'Insufficient balance'; return; }
      from.balance -= amt; to.balance += amt;
      const now = new Date().toISOString();
      state.transactions.push({id: uid('tx'), date: now, accountId: fromId, desc: `Transfer to ${to.name}`, type: 'debit', amount: amt});
      state.transactions.push({id: uid('tx'), date: now, accountId: toId, desc: `Transfer from ${from.name}`, type: 'credit', amount: amt});
      saveState(state); renderAccountSelects(); renderOverview(); renderTransactions();
      if(msgEl) msgEl.textContent = 'Transfer simulated locally.';
      document.getElementById('transferAmt').value = '';
    });
  }

  /* Create account (accounts page) */
  const createAccForm = document.getElementById('createAccountForm');
  if(createAccForm){
    createAccForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('newAccName').value.trim();
      const type = document.getElementById('newAccType').value;
      const bal = parseFloat(document.getElementById('newAccBalance').value || '0');
      if(!name){ alert('Enter a name'); return; }
      state.accounts.push({id: uid('acc'), name, type, balance: bal});
      saveState(state); renderAccountsList(); renderAccountSelects(); renderOverview();
      createAccForm.reset();
    });
  }

  /* Seed / Reset demo data */
  const seedBtn = document.getElementById('seedData');
  if(seedBtn) seedBtn.addEventListener('click', ()=>{ state = JSON.parse(JSON.stringify(SAMPLE)); saveState(state); renderAll(); alert('Seed data loaded (balances reset to ₹0).'); });
  const resetBtn = document.getElementById('resetData');
  if(resetBtn) resetBtn.addEventListener('click', ()=>{ if(confirm('Reset demo to defaults?')){ state = JSON.parse(JSON.stringify(SAMPLE)); saveState(state); renderAll(); } });

  /* Export CSV (transactions) */
  const exportBtn = document.getElementById('exportCsv');
  if(exportBtn){
    exportBtn.addEventListener('click', ()=> {
      const rows = [['date','account','description','type','amount']];
      state.transactions.slice().forEach(tx => {
        const acc = state.accounts.find(a=>a.id===tx.accountId);
        rows.push([tx.date, acc ? acc.name : tx.accountId, tx.desc, tx.type, tx.amount]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  /* Filters */
  const filterAcc = document.getElementById('filterAcc');
  if(filterAcc) filterAcc.addEventListener('change', renderTransactions);
  const typeFilter = document.getElementById('typeFilter');
  if(typeFilter) typeFilter.addEventListener('change', renderTransactions);
  const searchTx = document.getElementById('searchTx');
  if(searchTx) searchTx.addEventListener('input', renderTransactions);
  const clearFilter = document.getElementById('clearFilter');
  if(clearFilter) clearFilter.addEventListener('click', ()=>{ if(searchTx) searchTx.value=''; if(typeFilter) typeFilter.value='all'; renderTransactions(); });

  /* INVESTMENT SIMULATOR */
  function computeProjection(principal, annualRatePct, years, monthlyContribution){
    const monthlyRate = annualRatePct/100/12;
    const months = Math.round(years*12);
    let balance = principal;
    const points = [balance];
    for(let m=1;m<=months;m++){
      balance = balance*(1+monthlyRate) + monthlyContribution;
      if(m % Math.max(1, Math.floor(months/40)) === 0) points.push(balance);
    }
    return { final: balance, points };
  }

  function drawChart(canvasId, points){
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!points || points.length===0) return;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const pad = 30 * dpr;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    points.forEach((p,i)=>{
      const x = pad + (i/(points.length-1)) * (canvas.width - pad*2);
      const y = canvas.height - pad - ((p - min) / (max - min || 1)) * (canvas.height - pad*2);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${12*dpr}px sans-serif`;
    ctx.fillText(formatINR(points[0].toFixed(0)), 6*dpr, canvas.height - pad + 14*dpr);
    ctx.fillText(formatINR(points[points.length-1].toFixed(0)), canvas.width - 140*dpr, canvas.height - pad + 14*dpr);
  }

  const calcInvestBtn = document.getElementById('calcInvest');
  if(calcInvestBtn){
    calcInvestBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const principal = parseFloat(document.getElementById('principal').value || '0');
      const rate = parseFloat(document.getElementById('rate').value || '0');
      const years = parseFloat(document.getElementById('years').value || '0');
      const contrib = parseFloat(document.getElementById('contrib').value || '0');
      if(years <= 0){ alert('Enter valid years'); return; }
      const res = computeProjection(principal, rate, years, contrib);
      document.getElementById('investResults').innerHTML = `<div class="muted small">Projected after ${years} years:</div><div style="font-weight:800;font-size:18px">${formatINR(res.final.toFixed(2))}</div>`;
      drawChart('investChart', res.points);
    });
  }

  /* CALCULATORS (EMI & Investment on calculator page) */
  const emiForm = document.getElementById('emiForm');
  if(emiForm){
    emiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const P = parseFloat(document.getElementById('emiPrincipal').value || '0');
      const R = parseFloat(document.getElementById('emiRate').value || '0') / 100 / 12;
      const N = parseFloat(document.getElementById('emiYears').value || '0') * 12;
      if(N <= 0){ alert('Enter valid tenure'); return; }
      const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
      const out = document.getElementById('emiResult');
      if(out) out.textContent = `Monthly EMI: ${formatINR(emi.toFixed(2))}`;
    });
  }
  const emiReset = document.getElementById('emiReset');
  if(emiReset) emiReset.addEventListener('click', ()=>{ document.getElementById('emiForm')?.reset(); document.getElementById('emiResult').textContent=''; });

  const invCalc = document.getElementById('invCalc');
  if(invCalc){
    invCalc.addEventListener('click', (e)=>{
      e.preventDefault();
      const p = parseFloat(document.getElementById('invPrincipal').value || '0');
      const r = parseFloat(document.getElementById('invRate').value || '0');
      const y = parseFloat(document.getElementById('invYears').value || '0');
      const c = parseFloat(document.getElementById('invContrib').value || '0');
      if(y <= 0){ alert('Enter valid years'); return; }
      const res = computeProjection(p, r, y, c);
      document.getElementById('invOutput').innerHTML = `<div class="muted small">Projected: <strong>${formatINR(res.final.toFixed(0))}</strong></div>`;
      drawChart('invChart', res.points);
    });
  }
  const invReset = document.getElementById('invReset');
  if(invReset) invReset.addEventListener('click', ()=>{ document.getElementById('invForm')?.reset(); document.getElementById('invOutput').innerHTML=''; const c = document.getElementById('invChart'); if(c) c.getContext('2d').clearRect(0,0,c.width,c.height); });

  /* CONTACT form (client side) */
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.getElementById('cName').value;
      document.getElementById('contactResult').textContent = `Thanks ${name}, we'll contact you soon (demo).`;
      contactForm.reset();
    });
  }
  const contactReset = document.getElementById('contactReset');
  if(contactReset) contactReset.addEventListener('click', ()=>{ document.getElementById('contactForm')?.reset(); document.getElementById('contactResult').textContent=''; });

  /* CREATE ACCOUNT handler (accounts page) - duplicate safe */
  const createAccountForm = document.getElementById('createAccountForm');
  if(createAccountForm){
    createAccountForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.getElementById('newAccName').value.trim();
      if(!name){ alert('Enter a name'); return; }
      const type = document.getElementById('newAccType').value;
      const bal = parseFloat(document.getElementById('newAccBalance').value || '0');
      state.accounts.push({id: uid('acc'), name, type, balance: bal});
      saveState(state);
      renderAccountsList(); renderAccountSelects(); renderOverview();
      createAccountForm.reset();
    });
  }

  /* BALANCE TRACKER (account.html) - NEW */
  function renderBalanceUI(){
    const current = state.balanceHistory.length ? state.balanceHistory[state.balanceHistory.length-1].balanceAfter : 0;
    const el = document.getElementById('currentBalance');
    if(el) el.textContent = formatINR(current);
    const updatedEl = document.getElementById('balanceUpdated');
    if(updatedEl){
      const last = state.balanceHistory.length ? state.balanceHistory[state.balanceHistory.length-1].date : '—';
      updatedEl.textContent = last === '—' ? '—' : new Date(last).toLocaleString();
    }
    // render history table
    const hist = document.getElementById('balanceHistory');
    if(hist){
      hist.innerHTML = '';
      const rows = state.balanceHistory.slice().reverse();
      rows.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${new Date(item.date).toLocaleString()}</td><td style="text-transform:capitalize">${item.type}</td><td>${item.desc || ''}</td><td>${formatINR(item.amount)}</td><td>${formatINR(item.balanceAfter)}</td>`;
        hist.appendChild(tr);
      });
    }
  }

  const balanceForm = document.getElementById('balanceForm');
  if(balanceForm){
    balanceForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const type = document.getElementById('balanceType').value;
      const amount = parseFloat(document.getElementById('balanceAmount').value || '0');
      const desc = document.getElementById('balanceDesc').value || '';
      if(!amount || amount <= 0){ alert('Enter a valid amount'); return; }
      // for simplicity, apply to first account (Checking) — you can extend to choose account
      const mainAcc = state.accounts[0];
      if(!mainAcc){ alert('No account found. Create an account first.'); return; }
      if(type === 'deposit'){
        mainAcc.balance += amount;
      } else {
        // expense
        mainAcc.balance -= amount;
      }
      // record transaction and balanceHistory
      const now = new Date().toISOString();
      state.transactions.push({id: uid('t'), date: now, accountId: mainAcc.id, desc: desc || (type === 'deposit' ? 'Deposit' : 'Expense'), type: type === 'deposit' ? 'credit' : 'debit', amount: amount});
      const balanceAfter = mainAcc.balance;
      state.balanceHistory.push({id: uid('bh'), date: now, type, desc, amount, balanceAfter});
      saveState(state);
      renderAccountsList(); renderAccountSelects(); renderOverview(); renderTransactions(); renderBalanceUI();
      balanceForm.reset();
    });
  }

  const resetBalanceBtn = document.getElementById('resetBalance');
  if(resetBalanceBtn){
    resetBalanceBtn.addEventListener('click', ()=>{
      if(!confirm('Reset current balance to ₹0 and clear history?')) return;
      // reset all accounts to 0 and clear history and transactions
      state.accounts.forEach(a => a.balance = 0);
      state.transactions = [];
      state.balanceHistory = [];
      saveState(state);
      renderAll();
    });
  }

  const exportBalanceCsv = document.getElementById('exportBalanceCsv');
  if(exportBalanceCsv){
    exportBalanceCsv.addEventListener('click', ()=>{
      const rows = [['date','type','description','amount','balanceAfter']];
      state.balanceHistory.forEach(h => rows.push([h.date, h.type, h.desc || '', h.amount, h.balanceAfter]));
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'balance_history.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  const clearHistoryBtn = document.getElementById('clearHistory');
  if(clearHistoryBtn){
    clearHistoryBtn.addEventListener('click', ()=>{
      if(!confirm('Clear balance history? This does not change current balances.')) return;
      state.balanceHistory = [];
      saveState(state);
      renderBalanceUI();
    });
  }

  /* EXPORT / CSV wiring for dashboard done earlier */

  /* TRANSACTION TABLE wiring (transactions page) done earlier */

  /* INIT: ensure state exists */
  if(!state || !state.accounts) {
    state = JSON.parse(JSON.stringify(SAMPLE));
    saveState(state);
  }

  /* RENDER ALL helper */
  function renderAll(){
    renderAccountsList();
    renderAccountSelects();
    renderOverview();
    renderTransactions();
    renderBalanceUI();
  }

  renderAll();

  /* EXPOSE reset for debugging if needed */
  window.__finserve_reset = () => { localStorage.removeItem(KEY); state = JSON.parse(JSON.stringify(SAMPLE)); saveState(state); renderAll(); };

});
