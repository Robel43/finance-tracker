const MONTHS = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'];
const MONTHS_EN = ['Meskerem','Tikimt','Hidar','Tahsas','Tir','Yekatit','Megabit','Miazia','Ginbot','Sene','Hamle','Nehase','Pagumen'];
const DB_NAME = 'birrtrack-db';
const DB_VERSION = 2;
const STORES = ['transactions','loans','transfers','accounts','categories','settings','templates'];

const DEFAULT_CAT_EMOJI = {
  'Transportation':'🚌','Lunch':'🍽️','Personal':'🧴','Utilities':'💡','Home':'🏠','Other Expense':'🧾',
  'Salary':'💼','Upwork':'💻','Interest':'💹','Other Income':'➕'
};
const ACC_EMOJI = { Checking:'🏦', Savings:'💰', Wallet:'📱', Cash:'💵', Other:'💳' };
const CATEGORY_EMOJI_PICKS = ['🍽️','🚌','🧴','💡','🏠','🧾','💼','💻','💹','➕','🛒','📚','🏥','🎉','📱','⛽','🐾','✈️','☕','👕','🎁','💊'];
const ACCOUNT_EMOJI_PICKS = ['🏦','💰','📱','💵','💳','🐖','🏧','🌐'];
const QUICK_AMOUNTS = [50,100,200,500,1000];

const $app = document.querySelector('#app');
const state = { page:'dashboard', reportYear:null, reportMonth:null, modal:null, data:null, toast:null, compareA:1, compareB:2, txFilter:{scope:'month',q:'',type:'all',accountId:'all',categoryId:'all'} };

function id(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function money(n=0){ return `${Number(n).toLocaleString(undefined,{maximumFractionDigits:2})} ETB`; }
function esc(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function isGregLeap(y){ return (y%4===0 && y%100!==0)||y%400===0; }
function isEthLeap(y){ return y % 4 === 3; }
function daysInEthMonth(y,m){ return m <= 12 ? 30 : (isEthLeap(y) ? 6 : 5); }
function gregNewYearDay(gYear){ return isGregLeap(gYear+1) ? 12 : 11; }
function currentEthiopianDate(){
  const now = new Date();
  const gy=now.getFullYear(), gm=now.getMonth(), gd=now.getDate();
  const nyDay=gregNewYearDay(gy);
  const after = gm>8 || (gm===8 && gd>=nyDay);
  const startYear = after ? gy : gy-1;
  const ecYear = after ? gy-7 : gy-8;
  const start = Date.UTC(startYear,8,gregNewYearDay(startYear));
  const cur = Date.UTC(gy,gm,gd);
  const delta = Math.floor((cur-start)/86400000);
  return {year:ecYear, month:Math.floor(delta/30)+1, day:(delta%30)+1};
}
function dateKey(d){ return d.year*10000+d.month*100+d.day; }
function dateText(d){ return `${MONTHS[d.month-1]} ${d.day}, ${d.year}`; }
function reportMonthOf(d){ return Math.min(d.month,12); }

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{ const db=req.result; STORES.forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'}); }); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function storeOp(store, mode, fn){ const db=await openDB(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,mode); const os=tx.objectStore(store); const req=fn(os); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
const db = { all:s=>storeOp(s,'readonly',o=>o.getAll()), put:(s,v)=>storeOp(s,'readwrite',o=>o.put(v)), del:(s,k)=>storeOp(s,'readwrite',o=>o.delete(k)), clear:s=>storeOp(s,'readwrite',o=>o.clear()) };

async function getPrefs(){
  const all=await db.all('settings');
  return all.find(s=>s.id==='prefs') || {id:'prefs', lastAccountId:null, lastCategoryId:{}};
}
async function savePrefs(p){ await db.put('settings', p); }

function catEmoji(c){ if(!c) return '🏷️'; return c.emoji || DEFAULT_CAT_EMOJI[c.name] || (c.type==='income' ? '💰' : '💸'); }
function accEmoji(a){ if(!a) return '💳'; return a.emoji || ACC_EMOJI[a.type] || '💳'; }
function categoryObj(cid){ return state.data.categories.find(c=>c.id===cid); }
function accountObj(aid){ return state.data.accounts.find(a=>a.id===aid); }
function categoryLabel(cid){ const c=categoryObj(cid); return `${catEmoji(c)} ${esc(c?c.name:'Unknown')}`; }
function accountLabel(aid){ const a=accountObj(aid); return `${accEmoji(a)} ${esc(a?a.name:'Unknown')}`; }

async function seed(){
  if((await db.all('accounts')).length===0){
    for(const a of [
      {id:'acc_boa',name:'BOA',type:'Checking',openingBalance:0,emoji:'🏦'},
      {id:'acc_telebirr',name:'Telebirr',type:'Wallet',openingBalance:0,emoji:'📱'},
      {id:'acc_cbe',name:'CBE',type:'Savings',openingBalance:0,emoji:'💰'},
      {id:'acc_cash',name:'Cash',type:'Cash',openingBalance:0,emoji:'💵'}
    ]) await db.put('accounts',a);
  }
  if((await db.all('categories')).length===0){
    for(const c of [
      ['Transportation','expense','🚌'],['Lunch','expense','🍽️'],['Personal','expense','🧴'],['Utilities','expense','💡'],['Home','expense','🏠'],['Other Expense','expense','🧾'],
      ['Salary','income','💼'],['Upwork','income','💻'],['Interest','income','💹'],['Other Income','income','➕']
    ].map(([name,type,emoji])=>({id:`cat_${name.toLowerCase().replace(/\s/g,'_')}`,name,type,emoji}))) await db.put('categories',c);
  }
}
async function load(){
  const [transactions,loans,transfers,accounts,categories,settings,templates]=await Promise.all(STORES.map(s=>db.all(s)));
  state.data={transactions,loans,transfers,accounts,categories,settings,templates};
}
function accountName(idv){ return state.data.accounts.find(a=>a.id===idv)?.name || 'Unknown'; }
function categoryName(idv){ return state.data.categories.find(c=>c.id===idv)?.name || 'Other'; }

function monthTotals(year,month){
  const tx=state.data.transactions.filter(t=>t.date.year===year && reportMonthOf(t.date)===month);
  const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  return {income,expense,net:income-expense,tx};
}
function yearTotals(year){ return Array.from({length:12},(_,i)=>({month:i+1,...monthTotals(year,i+1)})); }
function categoryExpenseTotals(year,month){
  const out={}; monthTotals(year,month).tx.filter(t=>t.type==='expense').forEach(t=>out[t.categoryId]=(out[t.categoryId]||0)+Number(t.amount)); return out;
}
function loanPaid(l){ return (l.repayments||[]).reduce((s,r)=>s+Number(r.amount),0); }
function loanOutstanding(l){ return Math.max(0,Number(l.amount)-loanPaid(l)); }

function currentMonthData(){ return monthTotals(state.reportYear,state.reportMonth); }
function changeMonth(delta){
  let m=state.reportMonth+delta, y=state.reportYear;
  if(m<1){m=12;y--;} if(m>12){m=1;y++;}
  state.reportMonth=m; state.reportYear=y; render();
}
function toast(msg){ state.toast=msg; render(); setTimeout(()=>{state.toast=null;render();},1800); }

function layout(content){
  const nav=[['dashboard','🏠','Home'],['transactions','💸','Entries'],['loans','🤝','Loans'],['compare','📊','Compare'],['accounts','🏦','Accounts'],['settings','⚙️','Settings']];
  return `<div class="app-shell">
    <header class="topbar"><div class="brand"><div class="brand-mark">ብ</div><div>BirrTrack</div></div><div class="top-actions"><button class="icon-btn" data-action="addTx" title="Add transaction">➕</button></div></header>
    <div class="flag-accent"></div>
    <main>${content}</main>
    <nav class="nav">${nav.map(([p,i,l])=>`<button data-page="${p}" class="${state.page===p?'active':''}"><span class="ico">${i}</span>${l}</button>`).join('')}</nav>
    ${state.modal?modalHTML():''}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}
  </div>`;
}
function monthSwitcher(){ return `<div class="month-switcher"><button class="icon-btn" data-action="prevMonth">‹</button><div class="month-label">${MONTHS[state.reportMonth-1]} ${state.reportYear}${state.reportMonth===12?' + ጳጉሜ':''}</div><button class="icon-btn" data-action="nextMonth">›</button></div>`; }

function dashboard(){
  const t=currentMonthData();
  const recent=[...t.tx].sort((a,b)=>dateKey(b.date)-dateKey(a.date)).slice(0,8);
  const cat=categoryExpenseTotals(state.reportYear,state.reportMonth);
  const cats=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  return layout(`<div class="page-head"><div><h1>Dashboard</h1><p>🇪🇹 Ethiopian calendar · local data only</p></div>${monthSwitcher()}</div>
    <div class="grid kpis"><div class="card kpi income"><div class="kpi-label">📈 Income</div><div class="kpi-value good">${money(t.income)}</div></div><div class="card kpi expense"><div class="kpi-label">📉 Expenses</div><div class="kpi-value bad">${money(t.expense)}</div></div><div class="card kpi net"><div class="kpi-label">⚖️ Net</div><div class="kpi-value ${t.net>=0?'good':'bad'}">${money(t.net)}</div></div></div>
    ${state.data.templates.length?`<section class="card" style="margin-top:12px"><div class="section-title"><h2>⚡ Quick log</h2></div><div class="chips">${state.data.templates.map(tp=>`<button class="chip quick-chip" data-log-template="${tp.id}">${categoryLabel(tp.categoryId)} ${esc(tp.label)}</button>`).join('')}</div></section>`:''}
    <div class="grid" style="margin-top:12px;grid-template-columns:1.1fr .9fr"><section class="card"><div class="section-title"><h2>Recent transactions</h2><button class="btn small" data-action="addTx">＋ Add</button></div>${recent.length?`<div class="list">${recent.map(tx=>`<div class="row"><div><div class="row-title">${categoryLabel(tx.categoryId)}</div><div class="row-sub">${dateText(tx.date)} · ${accountLabel(tx.accountId)}${tx.note?` · ${esc(tx.note)}`:''}</div></div><div class="amount ${tx.type==='income'?'good':'bad'}">${tx.type==='income'?'+':'-'}${money(tx.amount)}</div></div>`).join('')}</div>`:'<div class="empty">No transactions this month. 🌱</div>'}</section>
    <section class="card"><div class="section-title"><h2>Expense categories</h2></div>${cats.length?`<div class="list">${cats.slice(0,8).map(([cid,val])=>`<div class="row"><div class="row-title">${categoryLabel(cid)}</div><div class="amount">${money(val)}</div></div>`).join('')}</div>`:'<div class="empty">Nothing to show yet.</div>'}</section></div>`);
}

function txFilterMatches(tx){
  const f=state.txFilter;
  if(f.scope==='month' && !(tx.date.year===state.reportYear && reportMonthOf(tx.date)===state.reportMonth)) return false;
  if(f.type!=='all' && tx.type!==f.type) return false;
  if(f.accountId!=='all' && tx.accountId!==f.accountId) return false;
  if(f.categoryId!=='all' && tx.categoryId!==f.categoryId) return false;
  if(f.q){
    const q=f.q.toLowerCase();
    const hay=`${categoryName(tx.categoryId)} ${accountName(tx.accountId)} ${tx.note||''}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}
function txListHTML(){
  const list=[...state.data.transactions].filter(txFilterMatches).sort((a,b)=>dateKey(b.date)-dateKey(a.date));
  if(!list.length) return '<div class="empty">No transactions match. Try clearing a filter.</div>';
  return `<div class="list">${list.map(tx=>`<div class="row"><div><div class="row-title">${categoryLabel(tx.categoryId)}</div><div class="row-sub">${dateText(tx.date)} · ${accountLabel(tx.accountId)}${tx.note?` · ${esc(tx.note)}`:''}</div></div><div class="row-end"><div class="amount ${tx.type==='income'?'good':'bad'}">${tx.type==='income'?'+':'-'}${money(tx.amount)}</div><div class="row-actions"><button class="chip" data-duplicate-tx="${tx.id}" title="Duplicate">⧉</button><button class="chip" data-edit-tx="${tx.id}" title="Edit">✎</button><button class="chip" data-delete-tx="${tx.id}" title="Delete">✕</button></div></div></div>`).join('')}</div>`;
}
function transactions(){
  const f=state.txFilter;
  return layout(`<div class="page-head"><div><h1>Transactions</h1><p>Income and expenses only. Loans stay separate.</p></div><button class="btn" data-action="addTx">＋ Add</button></div>
    <section class="card">
      <div class="tx-scope-row">
        <div class="tabs" aria-label="Transaction date scope"><button class="tab ${f.scope==='month'?'active':''}" data-tx-scope="month">By month</button><button class="tab ${f.scope==='all'?'active':''}" data-tx-scope="all">All time</button></div>
        ${f.scope==='month'?monthSwitcher():`<div class="muted tx-scope-note">Showing your complete transaction history</div>`}
      </div>
      <div class="filter-bar">
        <input id="txSearch" placeholder="🔍 Search notes, category, account" value="${esc(f.q)}">
        <select id="txFilterType"><option value="all" ${f.type==='all'?'selected':''}>All types</option><option value="expense" ${f.type==='expense'?'selected':''}>💸 Expense</option><option value="income" ${f.type==='income'?'selected':''}>💰 Income</option></select>
        <select id="txFilterAccount"><option value="all">All accounts</option>${state.data.accounts.map(a=>`<option value="${a.id}" ${f.accountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select>
        <select id="txFilterCategory"><option value="all">All categories</option>${state.data.categories.map(c=>`<option value="${c.id}" ${f.categoryId===c.id?'selected':''}>${catEmoji(c)} ${esc(c.name)}</option>`).join('')}</select>
      </div>
      <div id="txListContainer">${txListHTML()}</div>
    </section>`);
}

function loans(){
  const ls=[...state.data.loans].sort((a,b)=>dateKey(b.date)-dateKey(a.date));
  const total=ls.reduce((s,l)=>s+loanOutstanding(l),0);
  return layout(`<div class="page-head"><div><h1>Loans</h1><p>🤝 Money you loaned to other people.</p></div><button class="btn" data-action="addLoan">＋ New loan</button></div><div class="card" style="margin-bottom:12px"><div class="kpi-label">Total outstanding</div><div class="kpi-value">${money(total)}</div></div>${ls.length?`<div class="grid">${ls.map(l=>{const paid=loanPaid(l), out=loanOutstanding(l), pct=Math.min(100,Number(l.amount)?paid/Number(l.amount)*100:0);return `<section class="card loan-card"><div class="section-title"><div><h2>🧑 ${esc(l.person)}</h2><div class="row-sub">Loaned ${dateText(l.date)} · ${accountLabel(l.accountId)}</div></div><div class="row-actions"><button class="chip" data-edit-loan="${l.id}">Edit</button><button class="chip" data-delete-loan="${l.id}">Delete</button></div></div><div class="statline"><span>Original</span><strong>${money(l.amount)}</strong></div><div class="statline"><span>Returned</span><strong class="good">${money(paid)}</strong></div><div class="statline"><span>Outstanding</span><strong>${money(out)}</strong></div><div class="progress"><div style="width:${pct}%"></div></div>${out>0?`<button class="btn secondary" data-repay-loan="${l.id}">💵 Record repayment</button>`:'<div class="good"><strong>✅ Paid in full</strong></div>'}${(l.repayments||[]).length?`<div class="list">${[...l.repayments].sort((a,b)=>dateKey(b.date)-dateKey(a.date)).map(r=>`<div class="row"><div><div class="row-title">Repayment</div><div class="row-sub">${dateText(r.date)} · ${accountLabel(r.accountId)}${r.note?` · ${esc(r.note)}`:''}</div></div><div class="row-end"><div class="amount good">+${money(r.amount)}</div><div class="row-actions"><button class="chip" data-edit-repayment="${r.id}" data-loan-id="${l.id}" title="Edit repayment">✎</button><button class="chip" data-delete-repayment="${r.id}" data-loan-id="${l.id}" title="Delete repayment">✕</button></div></div></div>`).join('')}</div>`:''}</section>`}).join('')}</div>`:'<div class="card empty">No loans recorded.</div>'}`);
}

function compare(){
  const year=state.reportYear; const yearly=yearTotals(year); const max=Math.max(1,...yearly.flatMap(x=>[x.income,x.expense]));
  const a=monthTotals(year,state.compareA), b=monthTotals(year,state.compareB);
  const catA=categoryExpenseTotals(year,state.compareA), catB=categoryExpenseTotals(year,state.compareB);
  const categoryIds=[...new Set([...Object.keys(catA),...Object.keys(catB)])].sort((x,y)=>(catB[y]||0)+(catA[y]||0)-(catB[x]||0)-(catA[x]||0));
  const pct=(x,y)=> x===0 ? (y===0?'0%':'—') : `${((y-x)/x*100).toFixed(1)}%`;
  return layout(`<div class="page-head"><div><h1>Compare</h1><p>📊 12 financial months; Pagumen is included in Nehase.</p></div><div><select id="compareYear">${[year-2,year-1,year,year+1].map(y=>`<option ${y===year?'selected':''}>${y}</option>`).join('')}</select></div></div>
    <section class="card"><div class="section-title"><h2>Income vs expenses · ${year} E.C.</h2></div><div class="chart">${yearly.map(x=>`<div class="chart-row"><div class="chart-label">${MONTHS[x.month-1]}${x.month===12?' + ጳጉ':''}</div><div class="bars"><div class="bar income" title="Income ${money(x.income)}" style="width:${x.income/max*100}%"></div><div class="bar expense" title="Expenses ${money(x.expense)}" style="width:${x.expense/max*100}%"></div></div></div>`).join('')}</div><div class="legend"><span><i class="dot income"></i>Income</span><span><i class="dot expense"></i>Expenses</span></div></section>
    <section class="card" style="margin-top:12px"><div class="section-title"><h2>Compare two months</h2></div><div class="compare-grid"><div class="field"><label>Month A</label><select id="compareA">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${state.compareA===i+1?'selected':''}>${MONTHS[i]}${i===11?' + ጳጉሜ':''}</option>`).join('')}</select></div><div class="field"><label>Month B</label><select id="compareB">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${state.compareB===i+1?'selected':''}>${MONTHS[i]}${i===11?' + ጳጉሜ':''}</option>`).join('')}</select></div></div><div class="compare-grid" style="margin-top:12px"><div class="compare-box"><strong>${MONTHS[state.compareA-1]}</strong><div class="metric"><span>Income</span><strong>${money(a.income)}</strong></div><div class="metric"><span>Expenses</span><strong>${money(a.expense)}</strong></div><div class="metric"><span>Net</span><strong>${money(a.net)}</strong></div></div><div class="compare-box"><strong>${MONTHS[state.compareB-1]}</strong><div class="metric"><span>Income</span><strong>${money(b.income)} <small class="muted">${pct(a.income,b.income)}</small></strong></div><div class="metric"><span>Expenses</span><strong>${money(b.expense)} <small class="muted">${pct(a.expense,b.expense)}</small></strong></div><div class="metric"><span>Net</span><strong>${money(b.net)} <small class="muted">${pct(a.net,b.net)}</small></strong></div></div></div><hr/><div class="section-title"><h2>Expense categories</h2></div>${categoryIds.length?`<div class="list">${categoryIds.map(cid=>`<div class="row"><div><div class="row-title">${categoryLabel(cid)}</div><div class="row-sub">${MONTHS[state.compareA-1]} ${money(catA[cid]||0)} → ${MONTHS[state.compareB-1]} ${money(catB[cid]||0)}</div></div><div class="amount">${pct(catA[cid]||0,catB[cid]||0)}</div></div>`).join('')}</div>`:'<div class="empty">Add expenses to compare categories.</div>'}</section>`);
}

function accountBalance(accountId){
  const a=state.data.accounts.find(x=>x.id===accountId); let bal=Number(a?.openingBalance||0);
  state.data.transactions.forEach(t=>{ if(t.accountId===accountId) bal += t.type==='income'?Number(t.amount):-Number(t.amount); });
  state.data.loans.forEach(l=>{ if(l.accountId===accountId) bal-=Number(l.amount); (l.repayments||[]).forEach(r=>{if(r.accountId===accountId) bal+=Number(r.amount);}); });
  state.data.transfers.forEach(t=>{if(t.fromAccountId===accountId) bal-=Number(t.amount);if(t.toAccountId===accountId) bal+=Number(t.amount);}); return bal;
}
function accountUsage(accountId){
  return {
    transactions:state.data.transactions.filter(t=>t.accountId===accountId).length,
    loans:state.data.loans.filter(l=>l.accountId===accountId).length,
    repayments:state.data.loans.reduce((n,l)=>n+(l.repayments||[]).filter(r=>r.accountId===accountId).length,0),
    transfers:state.data.transfers.filter(t=>t.fromAccountId===accountId||t.toAccountId===accountId).length,
    templates:state.data.templates.filter(t=>t.accountId===accountId).length
  };
}
function accountUsageTotal(u){ return Object.values(u).reduce((s,n)=>s+n,0); }
function accounts(){
  const transfers=[...state.data.transfers].sort((a,b)=>dateKey(b.date)-dateKey(a.date));
  return layout(`<div class="page-head"><div><h1>Accounts</h1><p>Checking, savings, wallet and cash.</p></div><div style="display:flex;gap:8px"><button class="btn secondary" data-action="addTransfer">⇄ Transfer</button><button class="btn" data-action="addAccount">＋ Account</button></div></div><div class="grid">${state.data.accounts.map(a=>`<section class="card account-card"><div class="row"><div class="acc-badge">${accEmoji(a)}</div><div><div class="row-title">${esc(a.name)}</div><div class="row-sub">${esc(a.type)} · opening ${money(a.openingBalance)}</div></div><div><div class="amount">${money(accountBalance(a.id))}</div><div class="row-actions" style="justify-content:flex-end;margin-top:6px"><button class="chip" data-edit-account="${a.id}">Edit</button><button class="chip" data-delete-account="${a.id}">Delete</button></div></div></div></section>`).join('')}</div>
    <section class="card" style="margin-top:12px"><div class="section-title"><h2>⇄ Transfer history</h2><button class="btn small secondary" data-action="addTransfer">＋ Transfer</button></div>${transfers.length?`<div class="list">${transfers.map(t=>`<div class="row"><div><div class="row-title">${accountLabel(t.fromAccountId)} → ${accountLabel(t.toAccountId)}</div><div class="row-sub">${dateText(t.date)}${t.note?` · ${esc(t.note)}`:''}</div></div><div class="row-end"><div class="amount">${money(t.amount)}</div><div class="row-actions"><button class="chip" data-edit-transfer="${t.id}" title="Edit">✎</button><button class="chip" data-delete-transfer="${t.id}" title="Delete">✕</button></div></div></div>`).join('')}</div>`:'<div class="empty">No transfers yet.</div>'}</section>`);
}

function settings(){
  const expenseCats=state.data.categories.filter(c=>c.type==='expense');
  const incomeCats=state.data.categories.filter(c=>c.type==='income');
  const catChip=c=>`<span class="chip cat-chip">${catEmoji(c)} ${esc(c.name)}<button class="chip-icon" data-edit-category="${c.id}" title="Edit">✎</button><button class="chip-icon" data-delete-category="${c.id}" title="Delete">✕</button></span>`;
  return layout(`<div class="page-head"><div><h1>Settings & Backup</h1><p>Nothing is sent to a server.</p></div></div><div class="grid">
    <section class="card"><div class="section-title"><h2>💾 Backup & restore</h2></div><div class="notice">Your data exists only on this device. Export a backup regularly and keep the file somewhere safe.</div><div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn" data-action="exportBackup">⬇️ Export JSON backup</button><label class="btn secondary" style="display:inline-block">⬆️ Import JSON<input id="importFile" type="file" accept="application/json,.json" hidden></label><button class="btn secondary" data-action="exportCsv">📄 Export CSV</button></div></section>
    <section class="card"><div class="section-title"><h2>🏷️ Categories</h2><button class="btn small" data-action="addCategory">＋ Add</button></div><div class="cat-group"><h3>Expense</h3><div class="chips">${expenseCats.length?expenseCats.map(catChip).join(''):'<span class="muted">None yet.</span>'}</div></div><div class="cat-group" style="margin-top:12px"><h3>Income</h3><div class="chips">${incomeCats.length?incomeCats.map(catChip).join(''):'<span class="muted">None yet.</span>'}</div></div></section>
    <section class="card"><div class="section-title"><h2>⚡ Recurring templates</h2><button class="btn small" data-action="addTemplate">＋ Add</button></div>${state.data.templates.length?`<div class="list">${state.data.templates.map(t=>`<div class="row"><div><div class="row-title">${categoryLabel(t.categoryId)} ${esc(t.label)}</div><div class="row-sub">${t.type==='income'?'Income':'Expense'} · ${accountLabel(t.accountId)}${t.amount?` · ${money(t.amount)}`:' · amount set when logging'}</div></div><div style="display:flex;gap:6px"><button class="chip" data-edit-template="${t.id}">Edit</button><button class="chip" data-delete-template="${t.id}">Delete</button></div></div>`).join('')}</div>`:'<div class="empty">No templates yet. Add one for things like Salary or Rent to log them in one tap from the dashboard.</div>'}</section>
    <section class="card"><div class="section-title"><h2>📊 Data summary</h2></div><div class="metric"><span>Transactions</span><strong>${state.data.transactions.length}</strong></div><div class="metric"><span>Loans</span><strong>${state.data.loans.length}</strong></div><div class="metric"><span>Accounts</span><strong>${state.data.accounts.length}</strong></div></section>
    <section class="card"><div class="section-title"><h2>⚠️ Danger zone</h2></div><button class="btn danger" data-action="wipe">Delete all local data</button></section>
  </div>`);
}

function pageHTML(){ return ({dashboard,transactions,loans,compare,accounts,settings}[state.page]||dashboard)(); }

function dateFields(prefix,d=currentEthiopianDate()){
  return `<div class="field"><label>Year (E.C.)</label><input id="${prefix}Year" type="number" inputmode="numeric" value="${d.year}" min="1900" max="2300"></div><div class="field"><label>Month</label><select id="${prefix}Month">${MONTHS.map((m,i)=>`<option value="${i+1}" ${d.month===i+1?'selected':''}>${m} (${MONTHS_EN[i]})</option>`).join('')}</select></div><div class="field"><label>Day</label><input id="${prefix}Day" type="number" inputmode="numeric" value="${d.day}" min="1" max="30"></div>`;
}
function modalHTML(){
  const m=state.modal; if(!m) return '';
  if(m.type==='tx'){
    const v = m.values || {type:'expense',amount:'',categoryId:'',accountId:state.data.accounts[0]?.id||'',note:'',date:currentEthiopianDate()};
    const isEdit = !!m.editId;
    return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${isEdit?'✎ Edit transaction':'➕ Add transaction'}</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="txForm"><div class="form-grid">
      <div class="field"><label>Type</label><select id="txType"><option value="expense" ${v.type==='expense'?'selected':''}>💸 Expense</option><option value="income" ${v.type==='income'?'selected':''}>💰 Income</option></select></div>
      <div class="field"><label>Amount (ETB)</label><input id="txAmount" type="number" step="0.01" min="0.01" value="${v.amount||''}" required></div>
      <div class="field full"><label>Quick add</label><div class="chips">${QUICK_AMOUNTS.map(n=>`<button type="button" class="chip" data-action="addAmount" data-amount="${n}">+${n}</button>`).join('')}<button type="button" class="chip" data-action="clearAmount">Clear</button></div></div>
      <div class="field"><label>Category</label><select id="txCategory"></select></div>
      <div class="field"><label>Account</label><select id="txAccount">${state.data.accounts.map(a=>`<option value="${a.id}" ${v.accountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div>
      ${dateFields('tx',v.date)}
      <div class="field full"><label>Note</label><textarea id="txNote" placeholder="Optional">${esc(v.note||'')}</textarea></div>
    </div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn" type="submit">${isEdit?'Save changes':'Save'}</button></div></form></div></div>`;
  }
  if(m.type==='loan'){ const l=m.loanId?state.data.loans.find(x=>x.id===m.loanId):null; const paid=l?loanPaid(l):0; return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${l?'✎ Edit loan':'🤝 New loan'}</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="loanForm">${l&&paid?`<div class="notice">Already repaid: <strong>${money(paid)}</strong>. The loan amount cannot be reduced below this.</div>`:''}<div class="form-grid" style="margin-top:${l&&paid?'12px':'0'}"><div class="field"><label>Person</label><input id="loanPerson" value="${l?esc(l.person):''}" required></div><div class="field"><label>Amount loaned (ETB)</label><input id="loanAmount" type="number" step="0.01" min="${Math.max(0.01,paid)}" value="${l?l.amount:''}" required></div><div class="field"><label>Paid from</label><select id="loanAccount">${state.data.accounts.map(a=>`<option value="${a.id}" ${l?.accountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div>${dateFields('loan',l?.date||currentEthiopianDate())}<div class="field full"><label>Note</label><textarea id="loanNote">${l?esc(l.note||''):''}</textarea></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">${l?'Save changes':'Save loan'}</button></div></form></div></div>`; }
  if(m.type==='repay') { const l=state.data.loans.find(x=>x.id===m.loanId); const r=m.repaymentId?(l.repayments||[]).find(x=>x.id===m.repaymentId):null; const maxAmount=loanOutstanding(l)+(r?Number(r.amount):0); return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${r?'✎ Edit repayment':`💵 Repayment from ${esc(l.person)}`}</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="repayForm"><div class="notice">Available principal: <strong>${money(maxAmount)}</strong>. Principal repayments are not counted as income.</div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Principal returned (ETB)</label><input id="repayAmount" type="number" step="0.01" min="0.01" max="${maxAmount}" value="${r?r.amount:''}" required></div><div class="field"><label>Received into</label><select id="repayAccount">${state.data.accounts.map(a=>`<option value="${a.id}" ${r?.accountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div>${dateFields('repay',r?.date||currentEthiopianDate())}<div class="field full"><label>Note</label><textarea id="repayNote">${r?esc(r.note||''):''}</textarea></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">${r?'Save changes':'Save repayment'}</button></div></form></div></div>`; }
  if(m.type==='account'){ const a=m.accountId?state.data.accounts.find(x=>x.id===m.accountId):null; return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${a?'✎ Edit':'➕ Add'} account</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="accountForm"><div class="form-grid"><div class="field"><label>Name</label><input id="accName" value="${a?esc(a.name):''}" required></div><div class="field"><label>Type</label><select id="accType">${['Checking','Savings','Wallet','Cash','Other'].map(x=>`<option ${a?.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Opening balance (ETB)</label><input id="accOpening" type="number" step="0.01" value="${a?.openingBalance||0}"></div><div class="field full"><label>Emoji</label><input id="accEmojiInput" value="${a?esc(a.emoji||''):''}" maxlength="4" placeholder="🏦"></div><div class="field full"><div class="chips">${ACCOUNT_EMOJI_PICKS.map(e=>`<button type="button" class="chip" data-action="pickEmoji" data-emoji="${e}" data-target="accEmojiInput">${e}</button>`).join('')}</div></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">Save</button></div></form></div></div>`; }
  if(m.type==='transfer'){ const t=m.transferId?state.data.transfers.find(x=>x.id===m.transferId):null; return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${t?'✎ Edit transfer':'⇄ Transfer between accounts'}</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="transferForm"><div class="form-grid"><div class="field"><label>From</label><select id="trFrom">${state.data.accounts.map(a=>`<option value="${a.id}" ${t?.fromAccountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label>To</label><select id="trTo">${state.data.accounts.map(a=>`<option value="${a.id}" ${t?.toAccountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label>Amount (ETB)</label><input id="trAmount" type="number" step="0.01" min="0.01" value="${t?t.amount:''}" required></div>${dateFields('tr',t?.date||currentEthiopianDate())}<div class="field full"><label>Note</label><textarea id="trNote">${t?esc(t.note||''):''}</textarea></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">${t?'Save changes':'Transfer'}</button></div></form></div></div>`; }
  if(m.type==='category'){ const c=m.categoryId?state.data.categories.find(x=>x.id===m.categoryId):null; return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${c?'✎ Edit':'➕ Add'} category</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="categoryForm"><div class="form-grid"><div class="field"><label>Name</label><input id="catName" value="${c?esc(c.name):''}" required></div><div class="field"><label>Type</label><select id="catType"><option value="expense" ${c?.type!=='income'?'selected':''}>💸 Expense</option><option value="income" ${c?.type==='income'?'selected':''}>💰 Income</option></select></div><div class="field full"><label>Emoji</label><input id="catEmojiInput" value="${c?esc(c.emoji||''):''}" maxlength="4" placeholder="🏷️"></div><div class="field full"><div class="chips">${CATEGORY_EMOJI_PICKS.map(e=>`<button type="button" class="chip" data-action="pickEmoji" data-emoji="${e}" data-target="catEmojiInput">${e}</button>`).join('')}</div></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">Save</button></div></form></div></div>`; }
  if(m.type==='template'){ const t=m.templateId?state.data.templates.find(x=>x.id===m.templateId):null; return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>${t?'✎ Edit':'➕ Add'} template</h2><button class="icon-btn" data-action="closeModal">✕</button></div><form id="templateForm"><div class="form-grid"><div class="field full"><label>Label</label><input id="tplLabel" value="${t?esc(t.label):''}" placeholder="e.g. Salary, Rent" required></div><div class="field"><label>Type</label><select id="tplType"><option value="expense" ${t?.type!=='income'?'selected':''}>💸 Expense</option><option value="income" ${t?.type==='income'?'selected':''}>💰 Income</option></select></div><div class="field"><label>Amount (optional)</label><input id="tplAmount" type="number" step="0.01" min="0" value="${t&&t.amount?t.amount:''}" placeholder="Fill in when logging"></div><div class="field"><label>Category</label><select id="tplCategory"></select></div><div class="field"><label>Account</label><select id="tplAccount">${state.data.accounts.map(a=>`<option value="${a.id}" ${t?.accountId===a.id?'selected':''}>${accEmoji(a)} ${esc(a.name)}</option>`).join('')}</select></div><div class="field full"><label>Note (optional)</label><textarea id="tplNote">${t?esc(t.note||''):''}</textarea></div></div><div class="form-actions"><button type="button" class="btn secondary" data-action="closeModal">Cancel</button><button class="btn">Save</button></div></form></div></div>`; }
  if(m.type==='importPreview') return `<div class="modal-wrap"><div class="modal"><div class="section-title"><h2>Restore backup</h2><button class="icon-btn" data-action="closeModal">✕</button></div><div class="notice">This will replace all current local data.</div><div class="metric"><span>Transactions</span><strong>${m.payload.data.transactions?.length||0}</strong></div><div class="metric"><span>Loans</span><strong>${m.payload.data.loans?.length||0}</strong></div><div class="metric"><span>Accounts</span><strong>${m.payload.data.accounts?.length||0}</strong></div><div class="form-actions"><button class="btn secondary" data-action="exportBackup">Export current first</button><button class="btn danger" data-action="confirmImport">Restore backup</button></div></div></div>`;
  return '';
}

function syncCategorySelect(){
  const type=document.querySelector('#txType')?.value||'expense'; const sel=document.querySelector('#txCategory'); if(!sel)return;
  const opts=state.data.categories.filter(c=>c.type===type);
  sel.innerHTML=opts.map(c=>`<option value="${c.id}">${catEmoji(c)} ${esc(c.name)}</option>`).join('');
  const desired=state.modal?.values?.categoryId;
  if(desired && opts.some(c=>c.id===desired)) sel.value=desired;
}
function syncTemplateCategorySelect(){
  const type=document.querySelector('#tplType')?.value||'expense'; const sel=document.querySelector('#tplCategory'); if(!sel)return;
  const opts=state.data.categories.filter(c=>c.type===type);
  const existing=state.modal?.templateId?state.data.templates.find(x=>x.id===state.modal.templateId)?.categoryId:null;
  sel.innerHTML=opts.map(c=>`<option value="${c.id}">${catEmoji(c)} ${esc(c.name)}</option>`).join('');
  if(existing && opts.some(c=>c.id===existing)) sel.value=existing;
}
function readDate(prefix){ const year=Number(document.querySelector(`#${prefix}Year`).value), month=Number(document.querySelector(`#${prefix}Month`).value), day=Number(document.querySelector(`#${prefix}Day`).value); if(day<1||day>daysInEthMonth(year,month)) throw new Error(`That month has ${daysInEthMonth(year,month)} days.`); return {year,month,day}; }

function download(name,text,type='application/json'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function exportBackup(){
  const d=currentEthiopianDate(); const data={}; for(const s of STORES) data[s]=await db.all(s);
  const payload={backupVersion:1,calendar:'ethiopian',createdAt:new Date().toISOString(),ethiopianCreatedDate:d,data}; download(`birrtrack-backup-${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}.json`,JSON.stringify(payload,null,2));
}
function exportCSV(){
  const rows=[['Date (E.C.)','Type','Category','Account','Amount ETB','Note'],...[...state.data.transactions].sort((a,b)=>dateKey(a.date)-dateKey(b.date)).map(t=>[`${t.date.year}-${String(t.date.month).padStart(2,'0')}-${String(t.date.day).padStart(2,'0')}`,t.type,categoryName(t.categoryId),accountName(t.accountId),t.amount,t.note||''])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); download('birrtrack-transactions.csv',csv,'text/csv;charset=utf-8');
}

function bindTxRowActions(){
  document.querySelectorAll('[data-delete-tx]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete this transaction?')){ await db.del('transactions',b.dataset.deleteTx); await load(); refreshTxList(); toast('Transaction deleted'); } });
  document.querySelectorAll('[data-edit-tx]').forEach(b=>b.onclick=()=>{ const tx=state.data.transactions.find(t=>t.id===b.dataset.editTx); state.modal={type:'tx', editId:tx.id, values:{type:tx.type,amount:tx.amount,categoryId:tx.categoryId,accountId:tx.accountId,note:tx.note||'',date:tx.date}}; render(); });
  document.querySelectorAll('[data-duplicate-tx]').forEach(b=>b.onclick=()=>{ const tx=state.data.transactions.find(t=>t.id===b.dataset.duplicateTx); state.modal={type:'tx', values:{type:tx.type,amount:tx.amount,categoryId:tx.categoryId,accountId:tx.accountId,note:tx.note||'',date:currentEthiopianDate()}}; render(); });
}
function refreshTxList(){ const c=document.querySelector('#txListContainer'); if(!c) return; c.innerHTML=txListHTML(); bindTxRowActions(); }

async function render(){ await load(); $app.innerHTML=pageHTML(); bind(); if(state.modal?.type==='tx') syncCategorySelect(); if(state.modal?.type==='template') syncTemplateCategorySelect(); }
function bind(){
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render();});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.action;
    if(a==='addTx'){ const prefs=await getPrefs(); const defAccount=(prefs.lastAccountId && state.data.accounts.some(x=>x.id===prefs.lastAccountId))?prefs.lastAccountId:(state.data.accounts[0]?.id||''); state.modal={type:'tx', values:{type:'expense',amount:'',categoryId:prefs.lastCategoryId?.expense||'',accountId:defAccount,note:'',date:currentEthiopianDate()}}; }
    if(a==='addLoan') state.modal={type:'loan'};
    if(a==='addAccount') state.modal={type:'account'};
    if(a==='addTransfer') state.modal={type:'transfer'};
    if(a==='addCategory') state.modal={type:'category'};
    if(a==='addTemplate') state.modal={type:'template'};
    if(a==='closeModal') state.modal=null;
    if(a==='prevMonth') return changeMonth(-1);
    if(a==='nextMonth') return changeMonth(1);
    if(a==='exportBackup') await exportBackup();
    if(a==='exportCsv') exportCSV();
    if(a==='addAmount'){ const inp=document.querySelector('#txAmount'); const cur=Number(inp.value)||0; inp.value=String(cur+Number(b.dataset.amount)); return; }
    if(a==='clearAmount'){ const inp=document.querySelector('#txAmount'); if(inp) inp.value=''; return; }
    if(a==='pickEmoji'){ const target=document.querySelector(`#${b.dataset.target}`); if(target) target.value=b.dataset.emoji; return; }
    if(a==='wipe'){ if(confirm('Delete all local BirrTrack data? This cannot be undone unless you have a backup.')){ for(const s of STORES) await db.clear(s); await seed(); toast('Local data deleted'); return; } }
    if(a==='confirmImport'){ const p=state.modal.payload; for(const s of STORES){ await db.clear(s); for(const item of (p.data[s]||[])) await db.put(s,item); } state.modal=null; toast('Backup restored'); return; }
    render();
  });
  document.querySelector('#txType')?.addEventListener('change',syncCategorySelect);
  document.querySelector('#tplType')?.addEventListener('change',syncTemplateCategorySelect);
  document.querySelector('#compareYear')?.addEventListener('change',e=>{state.reportYear=Number(e.target.value);render();});
  document.querySelector('#compareA')?.addEventListener('change',e=>{state.compareA=Number(e.target.value);render();});
  document.querySelector('#compareB')?.addEventListener('change',e=>{state.compareB=Number(e.target.value);render();});
  document.querySelector('#importFile')?.addEventListener('change',async e=>{ try{const text=await e.target.files[0].text(); const p=JSON.parse(text); if(p.backupVersion!==1||p.calendar!=='ethiopian'||!p.data) throw new Error('Not a valid BirrTrack backup.'); state.modal={type:'importPreview',payload:p};render();}catch(err){alert(err.message);} });
  document.querySelectorAll('[data-tx-scope]').forEach(b=>b.onclick=()=>{ state.txFilter.scope=b.dataset.txScope; render(); });
  document.querySelector('#txSearch')?.addEventListener('input',e=>{ state.txFilter.q=e.target.value; refreshTxList(); });
  document.querySelector('#txFilterType')?.addEventListener('change',e=>{ state.txFilter.type=e.target.value; refreshTxList(); });
  document.querySelector('#txFilterAccount')?.addEventListener('change',e=>{ state.txFilter.accountId=e.target.value; refreshTxList(); });
  document.querySelector('#txFilterCategory')?.addEventListener('change',e=>{ state.txFilter.categoryId=e.target.value; refreshTxList(); });
  if(state.page==='transactions') bindTxRowActions();
  document.querySelectorAll('[data-edit-loan]').forEach(b=>b.onclick=()=>{state.modal={type:'loan',loanId:b.dataset.editLoan};render();});
  document.querySelectorAll('[data-delete-loan]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this loan and its repayment history?')){await db.del('loans',b.dataset.deleteLoan);toast('Loan deleted');}});
  document.querySelectorAll('[data-repay-loan]').forEach(b=>b.onclick=()=>{state.modal={type:'repay',loanId:b.dataset.repayLoan};render();});
  document.querySelectorAll('[data-edit-repayment]').forEach(b=>b.onclick=()=>{state.modal={type:'repay',loanId:b.dataset.loanId,repaymentId:b.dataset.editRepayment};render();});
  document.querySelectorAll('[data-delete-repayment]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this repayment?'))return;const l=state.data.loans.find(x=>x.id===b.dataset.loanId);l.repayments=(l.repayments||[]).filter(r=>r.id!==b.dataset.deleteRepayment);await db.put('loans',l);toast('Repayment deleted');});
  document.querySelectorAll('[data-edit-account]').forEach(b=>b.onclick=()=>{state.modal={type:'account',accountId:b.dataset.editAccount};render();});
  document.querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=async()=>{const aid=b.dataset.deleteAccount;if(state.data.accounts.length<=1){alert('Keep at least one account so transactions and loans always have somewhere to be recorded.');return;}const u=accountUsage(aid);if(accountUsageTotal(u)>0){const used=Object.entries(u).filter(([,n])=>n).map(([k,n])=>`${n} ${k}`).join(', ');alert(`This account is still used by ${used}. Move or delete those records first, then delete the account.`);return;}const a=accountObj(aid);if(confirm(`Delete ${a?.name||'this account'}?`)){await db.del('accounts',aid);const prefs=await getPrefs();if(prefs.lastAccountId===aid){prefs.lastAccountId=null;await savePrefs(prefs);}toast('Account deleted');}});
  document.querySelectorAll('[data-edit-transfer]').forEach(b=>b.onclick=()=>{state.modal={type:'transfer',transferId:b.dataset.editTransfer};render();});
  document.querySelectorAll('[data-delete-transfer]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this transfer?')){await db.del('transfers',b.dataset.deleteTransfer);toast('Transfer deleted');}});
  document.querySelectorAll('[data-log-template]').forEach(b=>b.onclick=()=>{ const t=state.data.templates.find(x=>x.id===b.dataset.logTemplate); state.modal={type:'tx', values:{type:t.type,amount:t.amount||'',categoryId:t.categoryId,accountId:t.accountId,note:t.note||'',date:currentEthiopianDate()}}; render(); });
  document.querySelectorAll('[data-edit-template]').forEach(b=>b.onclick=()=>{state.modal={type:'template',templateId:b.dataset.editTemplate};render();});
  document.querySelectorAll('[data-delete-template]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete this template?')){await db.del('templates',b.dataset.deleteTemplate);toast('Template deleted');} });
  document.querySelectorAll('[data-edit-category]').forEach(b=>b.onclick=()=>{state.modal={type:'category',categoryId:b.dataset.editCategory};render();});
  document.querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=async()=>{ const cid=b.dataset.deleteCategory; const inUse=state.data.transactions.some(t=>t.categoryId===cid)||state.data.templates.some(t=>t.categoryId===cid); if(inUse){ alert("This category is used by existing transactions or templates, so it can't be deleted. You can rename it instead."); return; } if(confirm('Delete this category?')){ await db.del('categories',cid); toast('Category deleted'); } });

  document.querySelector('#txForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      const type=document.querySelector('#txType').value;
      const accountId=document.querySelector('#txAccount').value;
      const categoryId=document.querySelector('#txCategory').value;
      const isEdit=!!state.modal.editId;
      await db.put('transactions',{id:isEdit?state.modal.editId:id('tx'),type,amount:Number(document.querySelector('#txAmount').value),categoryId,accountId,date:readDate('tx'),note:document.querySelector('#txNote').value.trim()});
      const prefs=await getPrefs(); prefs.lastAccountId=accountId; prefs.lastCategoryId={...(prefs.lastCategoryId||{}),[type]:categoryId}; await savePrefs(prefs);
      state.modal=null; toast(isEdit?'Transaction updated':'Transaction saved');
    }catch(err){alert(err.message);}
  });
  document.querySelector('#loanForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const existing=state.modal.loanId?state.data.loans.find(x=>x.id===state.modal.loanId):null;const amount=Number(document.querySelector('#loanAmount').value);const paid=existing?loanPaid(existing):0;if(amount+0.000001<paid)throw new Error(`Loan amount cannot be below the ${money(paid)} already repaid.`);await db.put('loans',{id:existing?.id||id('loan'),person:document.querySelector('#loanPerson').value.trim(),amount,accountId:document.querySelector('#loanAccount').value,date:readDate('loan'),note:document.querySelector('#loanNote').value.trim(),repayments:existing?.repayments||[]});state.modal=null;toast(existing?'Loan updated':'Loan saved');}catch(err){alert(err.message);}});
  document.querySelector('#repayForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const l=state.data.loans.find(x=>x.id===state.modal.loanId);const existing=state.modal.repaymentId?(l.repayments||[]).find(x=>x.id===state.modal.repaymentId):null;const amount=Number(document.querySelector('#repayAmount').value);const maxAmount=loanOutstanding(l)+(existing?Number(existing.amount):0);if(amount>maxAmount+0.000001) throw new Error('Repayment is larger than the available principal.');const repayment={id:existing?.id||id('repay'),amount,accountId:document.querySelector('#repayAccount').value,date:readDate('repay'),note:document.querySelector('#repayNote').value.trim()};l.repayments=existing?(l.repayments||[]).map(r=>r.id===existing.id?repayment:r):[...(l.repayments||[]),repayment];await db.put('loans',l);state.modal=null;toast(existing?'Repayment updated':'Repayment saved');}catch(err){alert(err.message);}});
  document.querySelector('#accountForm')?.addEventListener('submit',async e=>{e.preventDefault();const existing=state.modal.accountId?state.data.accounts.find(x=>x.id===state.modal.accountId):null;const accType=document.querySelector('#accType').value;await db.put('accounts',{id:existing?.id||id('acc'),name:document.querySelector('#accName').value.trim(),type:accType,openingBalance:Number(document.querySelector('#accOpening').value)||0,emoji:document.querySelector('#accEmojiInput').value.trim()||ACC_EMOJI[accType]||'💳'});state.modal=null;toast('Account saved');});
  document.querySelector('#transferForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const existing=state.modal.transferId?state.data.transfers.find(x=>x.id===state.modal.transferId):null;const from=document.querySelector('#trFrom').value,to=document.querySelector('#trTo').value;if(from===to)throw new Error('Choose two different accounts.');await db.put('transfers',{id:existing?.id||id('tr'),fromAccountId:from,toAccountId:to,amount:Number(document.querySelector('#trAmount').value),date:readDate('tr'),note:document.querySelector('#trNote').value.trim()});state.modal=null;toast(existing?'Transfer updated':'Transfer saved');}catch(err){alert(err.message);}});
  document.querySelector('#categoryForm')?.addEventListener('submit',async e=>{e.preventDefault();const existing=state.modal.categoryId?state.data.categories.find(x=>x.id===state.modal.categoryId):null;const name=document.querySelector('#catName').value.trim();if(!name)return;const type=document.querySelector('#catType').value;await db.put('categories',{id:existing?.id||id('cat'),name,type,emoji:document.querySelector('#catEmojiInput').value.trim()||(type==='income'?'💰':'💸')});state.modal=null;toast(existing?'Category updated':'Category added');});
  document.querySelector('#templateForm')?.addEventListener('submit',async e=>{e.preventDefault();const existing=state.modal.templateId?state.data.templates.find(x=>x.id===state.modal.templateId):null;const label=document.querySelector('#tplLabel').value.trim();if(!label)return;const amountVal=document.querySelector('#tplAmount').value;await db.put('templates',{id:existing?.id||id('tpl'),label,type:document.querySelector('#tplType').value,categoryId:document.querySelector('#tplCategory').value,accountId:document.querySelector('#tplAccount').value,amount:amountVal?Number(amountVal):null,note:document.querySelector('#tplNote').value.trim()});state.modal=null;toast(existing?'Template updated':'Template added');});
}

async function init(){
  const d=currentEthiopianDate(); state.reportYear=d.year; state.reportMonth=Math.min(d.month,12);
  await seed(); await render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
