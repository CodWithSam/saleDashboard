// ---- settings you may need to adjust to match the backend ----
const AUTH = { emailKey: 'emailId', passKey: 'password' };      // query-param names for GET /login
const UPLOAD_FIELD = 'file';                                    // multipart field name for POST /bulk-upload

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n == null || n === '' ? '–' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const neg = (n) => (Number(n) < 0 ? ' neg' : '');
const label = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const UP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>';
const pg = { dash: 0, sales: 0, size: 10 };

async function api(path, opt) {
  let r;
  try { r = await fetch('/api' + path, opt); } catch { throw new Error('Network error'); }
  const text = await r.text(); let d = text;
  try { d = JSON.parse(text); } catch { }
  if (!r.ok) throw new Error((d && (d.message || d.error)) || (typeof d === 'string' && d.slice(0, 160)) || 'Request failed (' + r.status + ')');
  return d;
}
const send = (path, method, body) => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let tt;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => (t.className = ''), 3500); }
const loading = (cols) => `<tr><td colspan="${cols}" class="empty">Loading…</td></tr>`;
const failed = (e) => `<div class="card neg">${esc(e.message)}</div>`;

// list API: works with a plain array (paged here) or a Spring Page object (paged by the server)
async function list(path, params, page, size) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && qs.set(k, v));
  qs.set('page', page); qs.set('size', size);
  const d = await api(path + '?' + qs);
  if (Array.isArray(d)) return { rows: d.slice(page * size, (page + 1) * size), total: d.length, pages: Math.max(1, Math.ceil(d.length / size)) };
  const rows = d.content || [];
  return { rows, total: d.totalElements ?? rows.length, pages: Math.max(1, d.totalPages || 1) };
}
function pager(el, key, r, reload) {
  const p = pg[key];
  el.innerHTML = `<span>${r.total} record${r.total === 1 ? '' : 's'}</span><span class="sp"></span>
  <label>Rows <select id="psz">${[10, 25, 50, 100].map((n) => `<option ${n === pg.size ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <button class="btn ghost sm" id="pp" ${p <= 0 ? 'disabled' : ''}>Prev</button><span>Page ${p + 1} of ${r.pages}</span><button class="btn ghost sm" id="pn" ${p + 1 >= r.pages ? 'disabled' : ''}>Next</button>`;
  el.querySelector('#psz').onchange = (e) => { pg.size = +e.target.value; pg.dash = pg.sales = 0; reload(); };
  el.querySelector('#pp').onclick = () => { pg[key]--; reload(); };
  el.querySelector('#pn').onclick = () => { pg[key]++; reload(); };
}

// ---- auth (front-end gate; the backend only returns true/false) ----
const user = () => JSON.parse(localStorage.getItem('user') || 'null');
function authView(mode = 'login') {
  document.body.classList.add('anon');
  const su = mode === 'signup';
  const f = (n, l, t = 'text', ac = '') => `<label>${l}<input name="${n}" type="${t}" required autocomplete="${ac}"></label>`;
  $('#view').innerHTML = `<div class="auth card"><h1>Sales desk</h1>
  <div class="tabs2"><button class="${su ? '' : 'on'}" data-m="login">Log in</button><button class="${su ? 'on' : ''}" data-m="signup">Sign up</button></div>
  <form id="af">${su ? f('name', 'Name', 'text', 'name') : ''}${f('email', 'Email', 'email', 'email')}${su ? f('phone', 'Phone number', 'tel', 'tel') : ''}
  ${f('password', 'Password', 'password', su ? 'new-password' : 'current-password')}${su ? f('confirm', 'Confirm password', 'password', 'new-password') : ''}
  <p class="err" id="aerr" role="alert"></p><button class="btn" id="abtn">${su ? 'Create account' : 'Log in'}</button></form></div>`;
  document.querySelectorAll('.tabs2 button').forEach((b) => (b.onclick = () => authView(b.dataset.m)));
  $('#af').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, err = $('#aerr'); err.textContent = ''; $('#abtn').disabled = true;
    try {
      const email = f.email.value.trim(), pw = f.password.value;
      if (su) {
        if (pw.length < 6) throw new Error('Password must be at least 6 characters');
        if (pw !== f.confirm.value) throw new Error('Passwords do not match');
        if (!/^\+?\d{7,15}$/.test(f.phone.value.replace(/[\s-]/g, ''))) throw new Error('Enter a valid phone number');
        const r = await send('/login', 'POST', { name: f.name.value.trim(), emailId: email, phoneNo: f.phone.value.trim(), password: pw, confirmPassword: f.confirm.value });
        if (r === false || r === 'false') throw new Error('Could not create the account');
        authView('login'); toast('Account created. Please log in.');
      } else {
        const ok = await api('/login?' + new URLSearchParams({ [AUTH.emailKey]: email, [AUTH.passKey]: pw }));
        if (ok !== true && ok !== 'true') throw new Error('Email or password is incorrect');
        localStorage.setItem('user', JSON.stringify({ email })); location.hash = '#/overview'; route();
      }
    } catch (x) { err.textContent = x.message; const b = $('#abtn'); if (b) b.disabled = false; }
  };
}
$('#logout').onclick = () => { localStorage.removeItem('user'); route(); };

// ---- routing ----
function route() {
  document.body.classList.toggle('anon', !user());
  if (!user()) return authView();
  const [path, qs] = (location.hash.slice(1) || '/overview').split('?');
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + path));
  ({ '/overview': overviewView, '/client': clientView, '/sales': salesView }[path] || overviewView)(new URLSearchParams(qs || ''));
}
addEventListener('hashchange', route);

// ---- Overview (landing page) ----
// async function overviewView() {
//   $('#view').innerHTML = '<h1>Overview</h1><div class="card empty">Loading…</div>';
//   try {
//     const d = await api('/payoutsOverview');
//     const k = [['Sale amount', d.sumAmount, 1], ['Projected payout', d.sumProjectedPayout, 1], ['Profit amount', d.sumProfitAmount, 1],
//     //  ['Actual payout', d.sumActualPayout, 1], ['Profit', d.sumProfit, 1], 
//      ['Total sales', d.totalSale, 0]];
//     const m = d.payoutOverview || [], cols = [...new Set(m.flatMap((o) => Object.keys(o)))];
//     const cell = (key, v) => (typeof v === 'number' && /percent/i.test(key) ? v + '%' : typeof v === 'number' && /amount|payout|profit/i.test(key) ? money(v) : esc(v ?? '–'));
//     $('#view').innerHTML = `<h1>Overview</h1><div class="cards">${k.map(([l, v, mn]) => `<div class="card"><small>${l}</small><b class="${mn ? neg(v).trim() : ''}">${mn ? money(v) : esc(v ?? 0)}</b></div>`).join('')}</div>`
//       + (m.length ? `<div class="wrapt"><table><thead><tr>${cols.map((c) => `<th ${c === cols[0] ? '' : 'class="n"'}>${label(c)}</th>`).join('')}</tr></thead><tbody>`
//         + m.map((o) => `<tr>${cols.map((c, i) => `<td ${i ? `class="n${neg(o[c])}"` : ''}>${cell(c, o[c])}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>' : '<div class="card empty">No monthly data yet.</div>');
//   } catch (e) { $('#view').innerHTML = '<h1>Overview</h1>' + failed(e); }
// }

async function overviewView() {
  $('#view').innerHTML = '<h1>Overview</h1><div class="card empty">Loading…</div>';

  try {
    const d = await api('/payoutsOverview');

    const k = [
      ['Sale amount', d.sumAmount, 1],
      ['Projected payout', d.sumProjectedPayout, 1],
      ['Profit amount', d.sumProfitAmount, 1],
      ['Total sales', d.totalSale, 0]
    ];

    const m = d.payoutOverview || [];

    // Hard-coded table headers in the required order
    const cols = [
      'month',
      'saleFareVsProfit',
      'totalSale',
      'saleAmount',
      'profitAmount'
    ];

    // Find the corresponding API field names, ignoring case
    const field = (o, candidates) => {
      const key = Object.keys(o).find(
        (k) => candidates.includes(k.toLowerCase())
      );
      return key ? o[key] : undefined;
    };

    const monthKey = m.length
      ? Object.keys(m[0]).find(
        (k) => /month|^m$|date/i.test(k)
      )
      : null;

    const saleKey = m.length
      ? Object.keys(m[0]).find(
        (k) => /sale.*(amount|fare)|^(amount|fare)$/i.test(k)
      )
      : null;

    const profitKey = m.length
      ? Object.keys(m[0]).find(
        (k) => /profit.*amount|^profit$/i.test(k)
      )
      : null;

    const salesKey = m.length
      ? Object.keys(m[0]).find(
        (k) => /total.*sale|sale.*count|^count$|^n$/i.test(k)
      )
      : null;

    const monthLabel = (v) => {
      if (!v) return '–';
      const s = String(v);
      const date = new Date(
        /^\d{4}-\d{2}$/.test(s) ? s + '-01' : s
      );

      return Number.isNaN(date.getTime())
        ? esc(v)
        : date.toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric'
        });
    };

    const saleValue = (o) => Number(saleKey ? o[saleKey] : 0) || 0;
    const profitValue = (o) => Number(profitKey ? o[profitKey] : 0) || 0;

    const max = Math.max(
      1,
      ...m.map((o) => saleValue(o))
    );

    const cell = (key, v) =>
      typeof v === 'number' && /percent/i.test(key)
        ? v + '%'
        : typeof v === 'number' &&
          /amount|fare|payout|profit/i.test(key)
          ? money(v)
          : esc(v ?? '–');

    $('#view').innerHTML =
      '<h1>Overview</h1>' +
      `<div class="cards">${k.map(([l, v, mn]) =>
        `<div class="card"><small>${l}</small><b class="${mn ? neg(v).trim() : ''}">${mn ? money(v) : esc(v ?? 0)
        }</b></div>`
      ).join('')
      }</div>` 

      // (m.length
      //   ? `<div class="wrapt"><table>
      //       <thead>
      //         <tr>
      //           <th>Month</th>
      //           <th>Sale fare vs profit</th>
      //           <th class="n">Sales</th>
      //           <th class="n">Sale fare</th>
      //           <th class="n">Profit</th>
      //         </tr>
      //       </thead>
      //       <tbody>${m.map((o) => {
      //     const fare = saleValue(o);
      //     const profit = profitValue(o);
      //     const month = monthKey ? o[monthKey] : null;
      //     const count = salesKey ? o[salesKey] : 0;

      //     return `<tr>
      //             <td>${monthLabel(month)}</td>
      //             <td style="width:40%">
      //               <div class="mbar" style="width:${Math.max(0, fare / max * 100)}%"></div>
      //               <div class="mbar p" style="width:${Math.max(0, profit / max * 100)}%"></div>
      //             </td>
      //             <td class="n">${esc(count ?? 0)}</td>
      //             <td class="n">${money(fare)}</td>
      //             <td class="n${neg(profit)}">${money(profit)}</td>
      //           </tr>`;
      //   }).join('')
      //   }</tbody>
      //     </table></div>
      //     <p class="hint">Teal bar: sale fare. Amber bar: profit.</p>`
      //   : '<div class="card empty">No monthly data yet.</div>');

  } catch (e) {
    $('#view').innerHTML = '<h1>Overview</h1>' + failed(e);
  }
}

// ---- Client / Service / POC dashboard ----
const BY = { client: ['Client', 'client'], service: ['Service', 'service'], poc: ['POC', 'poc'] };
function clientView(p) {
  const by = BY[p.get('by')] ? p.get('by') : 'client';
  $('#view').innerHTML = `<h1><select class="hsel" id="by" aria-label="Group by">${Object.entries(BY).map(([k, [l]]) => `<option value="${k}" ${k === by ? 'selected' : ''}>${l}</option>`).join('')}</select> dashboard</h1>
  <div class="wrapt"><table><thead><tr><th>${BY[by][0]}</th><th>Module</th><th class="n">Amount</th><th class="n">Projected payout</th><th class="n">Profit amount</th><th class="n">Actual payout</th><th class="n">Profit</th></tr></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pg"></div>`;
  $('#by').onchange = (e) => { pg.dash = 0; location.hash = '#/client?by=' + e.target.value; };
  const load = async () => {
    $('#tb').innerHTML = loading(7);
    try {
      const r = await list('/payoutsDashboard', { [by]: true }, pg.dash, pg.size);
      $('#tb').innerHTML = r.rows.length ? r.rows.map((o) => `<tr><td><a class="cl" href="#/sales?${BY[by][1]}=${encodeURIComponent(o.name ?? o.clientName ?? o.service ?? o.poc ?? o.modul ?? '')}">${esc(o.name ?? o.clientName ?? o.service ?? o.poc ?? o.modul ?? '–')}</a></td><td>${esc(o.modul ?? '–')}</td>
      <td class="n">${money(o.amount)}</td><td class="n">${money(o.projectedPayout)}</td><td class="n">${money(o.profitAmount)}</td><td class="n">${money(o.actualPayout)}</td><td class="n${neg(o.profit)}">${money(o.profit)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No data.</td></tr>';
      pager($('#pg'), 'dash', r, load);
    } catch (e) { $('#tb').innerHTML = `<tr><td colspan="7" class="neg">${esc(e.message)}</td></tr>`; }
  };
  load();
}

// ---- Sales ----
const FIELDS = [['clientId', 'Client ID', 's'], ['status', 'Status', 's'], ['srNo', 'Sr no', 'n'], ['clientName', 'Client name', 's'], ['projectNameAndCode', 'Project name & code', 's'],
['amount', 'Amount', 'm'], ['projectedPayout', 'Projected payout', 'm'], ['profitAmount', 'Profit amount', 'm'], ['profitPercent', 'Profit %', 'p'], ['actualPayout', 'Actual payout', 'm'],
['profit', 'Profit', 'm'], ['profitPercentActual', 'Profit % (actual)', 'p'], ['amolApproved', 'Amol approved', 'b'], ['invoiceNo', 'Invoice no', 's'], ['poc', 'POC', 's'],
['service', 'Service', 's'], ['claimId', 'Claim ID', 's'], ['paymentStatus', 'Payment status', 's'], ['remarks', 'Remarks', 's']];
const FKEYS = ['clientName', 'invoiceNo', 'projectNameAndCode', 'poc', 'service', 'fromDate', 'toDate'];
const fmt = (t, v) => (t === 'm' ? money(v) : t === 'p' ? (v == null ? '–' : v + '%') : t === 'b' ? (v == null ? '–' : v ? 'Yes' : 'No') : esc(v ?? '–'));
let editing = null, rows = [], reloadSales = () => { };

function salesView(p) {
  const F = {}; FKEYS.forEach((k) => (F[k] = p.get(k) || '')); pg.sales = 0;
  const inp = ([k, l]) => `<label>${l}<input name="${k}" value="${esc(F[k])}"></label>`;
  $('#view').innerHTML = `<h1>Sales</h1><form class="bar" id="ff">${[['clientName', 'Client'], ['invoiceNo', 'Invoice no'], ['projectNameAndCode', 'Project / code'], ['poc', 'POC'], ['service', 'Service']].map(inp).join('')}
  <label>From<input type="date" name="fromDate" value="${F.fromDate}"></label><label>To<input type="date" name="toDate" value="${F.toDate}"></label>
  <button class="btn">Apply</button><button type="button" class="btn ghost" id="fclr">Clear</button><span class="grow"></span>
  <button type="button" class="btn ghost icon" id="imp" title="Import Excel" aria-label="Import Excel">${UP}</button><input type="file" id="file" hidden accept=".xlsx,.xls,.csv">
  <button type="button" class="btn" id="add">+ Add sale</button></form>
  <div class="wrapt"><table><thead><tr>${FIELDS.map(([, l, t]) => `<th ${'mpn'.includes(t) ? 'class="n"' : ''}>${l}</th>`).join('')}<th></th></tr></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pg"></div>`;
  const cols = FIELDS.length + 1;
  const load = reloadSales = async () => {
    $('#tb').innerHTML = loading(cols);
    try {
      const r = await list('/getPayouts', F, pg.sales, pg.size); rows = r.rows;
      $('#tb').innerHTML = rows.length ? rows.map((o, i) => `<tr>${FIELDS.map(([k, , t]) => `<td ${'mpn'.includes(t) ? `class="n${t === 'm' ? neg(o[k]) : ''}"` : ''}>${fmt(t, o[k])}</td>`).join('')}<td><button class="btn ghost sm" data-i="${i}">Edit</button></td></tr>`).join('') : `<tr><td colspan="${cols}" class="empty">No sales match these filters.</td></tr>`;
      pager($('#pg'), 'sales', r, load);
    } catch (e) { $('#tb').innerHTML = `<tr><td colspan="${cols}" class="neg">${esc(e.message)}</td></tr>`; }
  };
  $('#ff').onsubmit = (e) => {
    e.preventDefault(); FKEYS.forEach((k) => (F[k] = e.target[k].value.trim())); pg.sales = 0;
    history.replaceState(null, '', '#/sales?' + new URLSearchParams(Object.entries(F).filter(([, v]) => v))); load();
  };
  $('#fclr').onclick = () => { FKEYS.forEach((k) => ((F[k] = ''), ($('#ff')[k].value = ''))); history.replaceState(null, '', '#/sales'); pg.sales = 0; load(); };
  $('#add').onclick = () => openForm(null);
  $('#tb').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) openForm(rows[+b.dataset.i]); };
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append(UPLOAD_FIELD, f);
    try { const r = await api('/bulk-upload', { method: 'POST', body: fd }); toast(typeof r === 'string' && r ? r : 'Import completed'); load(); }
    catch (x) { toast(x.message, true); }
    e.target.value = '';
  };
  load();
}

const form = $('#form');
function openForm(row) {
  editing = row; $('#dlgTitle').textContent = row ? 'Edit sale' : 'Add sale'; $('#ferr').textContent = '';
  $('#fields').innerHTML = FIELDS.map(([k, l, t]) => t === 'b'
    ? `<label class="chk"><input type="checkbox" name="${k}" ${row && row[k] ? 'checked' : ''}> ${l}</label>`
    : `<label>${l}<input name="${k}" type="${t === 's' ? 'text' : 'number'}" ${t === 's' ? '' : 'step="any"'} value="${row && row[k] != null ? esc(row[k]) : ''}"></label>`).join('');
  $('#dlg').showModal();
}
$('#cancel').onclick = () => $('#dlg').close();
form.onsubmit = async (e) => {
  e.preventDefault(); $('#save').disabled = true; $('#ferr').textContent = '';
  try {
    const body = {};
    FIELDS.forEach(([k, , t]) => { const el = form.elements[k]; body[k] = t === 'b' ? el.checked : t === 's' ? el.value.trim() || null : el.value === '' ? null : Number(el.value); });
    if (editing) body.id = editing.id;
    await send(editing ? '/payouts/' + editing.id : '/payouts', editing ? 'PUT' : 'POST', body);
    $('#dlg').close(); toast('Saved'); reloadSales();
  } catch (x) { $('#ferr').textContent = x.message; }
  $('#save').disabled = false;
};


route();
