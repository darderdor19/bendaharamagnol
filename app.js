/* app.js — Bendahara Tongkrongan */

const MEMBERS_ORDER = ['darderdor', 'diosg', 'nehru', 'firdiads'];
const AV_CLASS      = ['av-0', 'av-1', 'av-2', 'av-3'];
let currentMember = null;

function rp(n) { return 'Rp\u00A0' + Number(n).toLocaleString('id-ID'); }
function avIdx(name) { const i = MEMBERS_ORDER.indexOf((name||'').toLowerCase()); return i>=0?i:0; }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function fmtDateInput(s) { if (!s) return null; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }

function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 3200);
}

async function req(method, url, body) {
  const baseUrl = 'http://localhost:5000'; 
  const opts = { 
    method, 
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(baseUrl + url, opts);
    return await res.json();
  } catch (e) {
    return { success: false, error: true };
  }
}

function calcStatus(transactions) {
  const debts = [...transactions.filter(t=>t.type==='debt')]
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  let paid = transactions.filter(t=>t.type==='payment').reduce((s,t)=>s+t.amount, 0);
  const map = {};
  for (const d of debts) {
    if (paid >= d.amount) { map[d.id]='lunas'; paid -= d.amount; }
    else { map[d.id]='belum'; }
  }
  return map;
}

async function loadDashboard() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '<div class="card skeleton"></div>'.repeat(4);
  try {
    const results = await Promise.all(MEMBERS_ORDER.map(n=>req('GET',`/api/member/${n}`)));
    
    if (results.every(r => r.error)) {
       grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--bg2); border-radius:24px; border:1px solid var(--red);">
          <h3 style="color:var(--red); margin-bottom:10px; font-size:20px;">🔴 SERVER BELUM JALAN</h3>
          <p style="color:var(--text3); font-size:14px; margin-bottom:20px;">Dashboard butuh server buat ngambil data hutang.</p>
          <div style="background:#000; padding:15px; border-radius:12px; font-family:monospace; font-size:13px; color:var(--gold); margin-bottom:20px; display:inline-block; text-align:left; border:1px solid var(--border2);">
            1. Buka Terminal / CMD di folder project<br>
            2. Ketik: <b style="color:#fff">node server.js</b><br>
            3. Refresh halaman ini (F5)
          </div>
        </div>`;
       return;
    }

    const members = results.map(r=>r.data).filter(Boolean);
    const totDebt   = members.reduce((s,m)=>s+m.total_debt, 0);
    const totPaid   = members.reduce((s,m)=>s+m.total_paid, 0);
    const totRemain = members.reduce((s,m)=>s+Math.max(0,m.remaining), 0);
    
    grid.innerHTML = members.map(m=>buildCard(m)).join('');
  } catch(e) {
    grid.innerHTML = `<p style="color:var(--red);padding:20px;grid-column:1/-1;">Terjadi kesalahan sistem. Coba restart server.</p>`;
  }
}

function buildCard(m) {
  const idx     = avIdx(m.name);
  const hasDebt = m.remaining > 0;
  const badge   = hasDebt
    ? `<span class="badge badge-debt">⚠️ Masih Hutang</span>`
    : `<span class="badge badge-lunas">✅ Lunas</span>`;

  const txs    = m.transactions || [];
  const statusMap = calcStatus(txs);

  // Hanya tampilkan hutang (debt) di list kartu, payments hanya mempengaruhi status
  const debtList = txs.filter(t=>t.type==='debt');
  const payList  = txs.filter(t=>t.type==='payment');

  let listHTML = '';

  if (debtList.length === 0) {
    listHTML = `<p class="cl-empty">Belum ada hutang</p>`;
  } else {
    listHTML = debtList.map(t => {
      const status  = statusMap[t.id];
      const badgeTx = status === 'lunas'
        ? `<span class="cl-badge cl-lunas">Lunas</span>`
        : `<span class="cl-badge cl-belum">Belum</span>`;
      const desc = t.description || '';
      const tgl  = t.debt_date   || '–';
      return `
        <div class="cl-item">
          <div class="cl-left">
            <span class="cl-tgl">📅 ${tgl}</span>
            ${desc ? `<span class="cl-desc">${desc}</span>` : ''}
          </div>
          <div class="cl-right">
            <span class="cl-amount">${rp(t.amount)}</span>
            ${badgeTx}
          </div>
        </div>`;
    }).join('');
  }

  // Tampilkan juga total pembayaran jika ada
  const payInfo = payList.length > 0
    ? `<div class="cl-pay-row">
        <span class="cl-pay-lbl">💵 Total Terbayar</span>
        <span class="cl-pay-val">${rp(m.total_paid)}</span>
       </div>`
    : '';

  return `
    <div class="card">
      <div class="card-top">
        <div class="av ${AV_CLASS[idx]}">${m.name[0].toUpperCase()}</div>
        <div>
          <p class="card-name">${m.name}</p>
          ${badge}
        </div>
      </div>

      <div class="card-summary">
        <div class="cs-row">
          <span class="cs-lbl">Total Hutang</span>
          <span class="cs-val red">${rp(m.total_debt)}</span>
        </div>
        <div class="cs-row">
          <span class="cs-lbl">Sisa</span>
          <span class="cs-val gold">${m.remaining <= 0 ? '✅ Lunas' : rp(m.remaining)}</span>
        </div>
      </div>

      <div class="card-list-wrap">
        <p class="cl-title">Daftar Hutang</p>
        <div class="card-list">${listHTML}</div>
        ${payInfo}
      </div>

      <button class="card-btn" onclick="openModal('${m.name}')">📋 Kelola Hutang →</button>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────
async function openModal(name) {
  currentMember = name;
  const idx = avIdx(name);
  const av  = document.getElementById('mAvatar');
  av.className   = `modal-avatar ${AV_CLASS[idx]}`;
  av.textContent = name[0].toUpperCase();
  document.getElementById('mName').textContent = name;
  document.getElementById('mSub').textContent  = 'Memuat…';
  switchTab('debt');
  ['debtAmount','debtDesc','payAmount','payDesc'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('debtDate').value = todayISO();
  document.getElementById('payDate').value  = todayISO();
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  await refreshModal(name);
}

async function refreshModal(name) {
  try {
    const { data: d } = await req('GET', `/api/member/${encodeURIComponent(name)}`);
    const hasDebt = d.remaining > 0;
    const hasTx   = (d.transactions?.length || 0) > 0;

    document.getElementById('mSub').textContent = hasDebt
      ? `⚠️ Sisa hutang ${rp(d.remaining)}` : '✅ Lunas';
    document.getElementById('mTotalDebt').textContent = rp(d.total_debt);
    document.getElementById('mTotalPaid').textContent = rp(d.total_paid);
    document.getElementById('mRemaining').textContent = d.remaining<=0 ? '✅ Lunas' : rp(d.remaining);

    const txList = document.getElementById('txList');
    if (!hasTx) { txList.innerHTML='<p class="tx-empty">Belum ada transaksi</p>'; return; }

    const statusMap = calcStatus(d.transactions);
    txList.innerHTML = d.transactions.map(t=>{
      const isDebt = t.type==='debt';
      const tgl    = t.debt_date || '–';
      const desc   = t.description || '';
      const stBadge = isDebt
        ? (statusMap[t.id]==='lunas'
            ? `<span class="cl-badge cl-lunas" style="font-size:10px">Lunas</span>`
            : `<span class="cl-badge cl-belum" style="font-size:10px">Belum</span>`)
        : `<span class="cl-badge" style="font-size:10px;background:rgba(61,220,132,0.15);color:var(--green);border:1px solid rgba(61,220,132,0.25)">Bayar</span>`;
      return `
        <div class="tx-item" id="tx-${t.id}">
          <div class="tx-dot ${t.type}"></div>
          <div class="tx-info">
            <p class="tx-meta">
              ${isDebt?'💸 Hutang':'✅ Bayar'}
              <span class="tx-date">📅 ${tgl}</span>
            </p>
            ${desc?`<p class="tx-note">📝 ${desc}</p>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span class="tx-amount ${t.type}">${isDebt?'+':'−'}${rp(t.amount)}</span>
            ${stBadge}
          </div>
          <button class="tx-del" onclick="deleteTx(${t.id},'${name}')" title="Hapus">🗑</button>
        </div>`;
    }).join('');
  } catch { toast('Gagal memuat detail','err'); }
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentMember = null;
}

function switchTab(tab) {
  document.getElementById('tabDebt').className  = `tab${tab==='debt'?' active':''}`;
  document.getElementById('tabPay').className   = `tab${tab==='pay'?' active':''}`;
  document.getElementById('panelDebt').className = `form-panel${tab!=='debt'?' hidden':''}`;
  document.getElementById('panelPay').className  = `form-panel${tab!=='pay'?' hidden':''}`;
}

async function submitDebt() {
  const amount = Number(document.getElementById('debtAmount').value);
  const description = document.getElementById('debtDesc').value.trim();
  const debt_date   = fmtDateInput(document.getElementById('debtDate').value);
  if (!amount||amount<=0) return toast('Masukkan jumlah yang valid','err');
  const btn=document.getElementById('btnDebt');
  btn.disabled=true; btn.textContent='Menyimpan…';
  try {
    const res = await req('POST','/api/debt/add',{name:currentMember,amount,description,debt_date});
    if (res.success) {
      toast(res.message,'ok');
      document.getElementById('debtAmount').value='';
      document.getElementById('debtDesc').value='';
      document.getElementById('debtDate').value=todayISO();
      await refreshModal(currentMember); loadDashboard();
    } else toast(res.message,'err');
  } catch { toast('Kesalahan jaringan','err'); }
  btn.disabled=false; btn.textContent='💸 Tambah Hutang';
}

async function submitPay() {
  const amount = Number(document.getElementById('payAmount').value);
  const description = document.getElementById('payDesc').value.trim();
  const debt_date   = fmtDateInput(document.getElementById('payDate').value);
  if (!amount||amount<=0) return toast('Masukkan jumlah yang valid','err');
  const btn=document.getElementById('btnPay');
  btn.disabled=true; btn.textContent='Menyimpan…';
  try {
    const res = await req('POST','/api/debt/pay',{name:currentMember,amount,description,debt_date});
    if (res.success) {
      if (res.wasReset) {
        toast(`🎉 ${currentMember} LUNAS! Semua hutang direset.`, 'ok');
        closeModal();
      } else {
        toast(res.message,'ok');
      }
      document.getElementById('payAmount').value='';
      document.getElementById('payDesc').value='';
      document.getElementById('payDate').value=todayISO();
      if (!res.wasReset) await refreshModal(currentMember);
      loadDashboard();
    } else toast(res.message,'err');
  } catch { toast('Kesalahan jaringan','err'); }
  btn.disabled=false; btn.textContent='✅ Catat Pembayaran';
}

async function deleteTx(id, name) {
  if (!confirm('Hapus transaksi ini?')) return;
  try {
    const res = await req('DELETE',`/api/transaction/${id}`);
    if (res.success) { toast('Dihapus','ok'); await refreshModal(name); loadDashboard(); }
    else toast(res.message,'err');
  } catch { toast('Gagal menghapus','err'); }
}

document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
document.getElementById('btnRefresh').onclick = () => {
  toast('Memperbarui data...', 'ok');
  loadDashboard();
};
loadDashboard();
