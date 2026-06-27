'use strict';

/* ── Avatar helpers ── */
const AVATAR_COLORS = ['#3B82F6','#2DD4BF','#F97316','#A78BFA','#FB923C','#EC4899'];
const AVATAR_BG     = ['rgba(59,130,246,0.18)','rgba(45,212,191,0.18)','rgba(249,115,22,0.18)','rgba(167,139,250,0.18)','rgba(251,146,60,0.18)','rgba(236,72,153,0.18)'];

function colorIdx(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return h;
}
function initials(name) { return (name || '?').slice(0, 2).toUpperCase(); }
function avatarCSS(name, size = 36) {
  const i = colorIdx(name);
  return `width:${size}px;height:${size}px;border-radius:50%;background:${AVATAR_BG[i]};border:1px solid ${AVATAR_COLORS[i]}40;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size * 0.36)}px;font-weight:600;color:${AVATAR_COLORS[i]};flex-shrink:0`;
}
function avatarEl(name, size = 36) {
  return `<div style="${avatarCSS(name, size)}">${initials(name)}</div>`;
}

/* ── Format helpers ── */
function fmt(n) { return 'RM ' + parseFloat(n || 0).toFixed(2); }
function fmtShort(n) { return parseFloat(n || 0).toFixed(2); }
function datestamp() {
  return new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Firebase refs (set after fb-ready) ── */
let db, fs;

/* ── App state ── */
const S = {
  currentUid: null,
  users: {},       // uid → { id, name, pin, txns[], goal }
  joints: {},      // jid → { id, name, members[], txns[], goal }
  unsubUsers: null,
  unsubJoints: null,
};

function curUser()  { return S.users[S.currentUid] || { name: '', txns: [], goal: 0 }; }
function myTxns()   { return curUser().txns || []; }
function myTotal()  { return myTxns().reduce((a, t) => a + (t.amount || 0), 0); }
function myJoints() { return Object.values(S.joints).filter(j => (j.members || []).includes(S.currentUid)); }

/* ═══════════════════════════════════════
   FIREBASE CRUD
═══════════════════════════════════════ */

async function fbGetUsers() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'app', 'users'));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

async function fbSaveUsers() {
  try {
    await fs.setDoc(fs.doc(db, 'app', 'users'), S.users);
  } catch (e) { console.error('saveUsers', e); }
}

async function fbGetJoints() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'app', 'joints'));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

async function fbSaveJoints() {
  try {
    await fs.setDoc(fs.doc(db, 'app', 'joints'), S.joints);
  } catch (e) { console.error('saveJoints', e); }
}

/* Real-time listeners */
function subscribeRealtime() {
  if (S.unsubUsers) S.unsubUsers();
  if (S.unsubJoints) S.unsubJoints();

  S.unsubUsers = fs.onSnapshot(fs.doc(db, 'app', 'users'), snap => {
    if (snap.exists()) {
      S.users = snap.data();
      if (S.currentUid && document.getElementById('pg-main').classList.contains('active')) {
        renderHeader();
        populateActiveTab();
      }
    }
  });

  S.unsubJoints = fs.onSnapshot(fs.doc(db, 'app', 'joints'), snap => {
    if (snap.exists()) {
      S.joints = snap.data();
      if (S.currentUid && document.getElementById('pg-main').classList.contains('active')) {
        renderAddTarget();
        populateActiveTab();
      }
      const jdPage = document.getElementById('pg-joint');
      if (jdPage.classList.contains('active') && S.curJoint) {
        renderJointDetail();
      }
    }
  });
}

/* ═══════════════════════════════════════
   PAGE ROUTING
═══════════════════════════════════════ */

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMain(tab = 'mine') {
  renderHeader();
  renderAddTarget();
  showPage('pg-main');
  switchTab(tab);
}

/* ═══════════════════════════════════════
   LOGIN / REGISTER
═══════════════════════════════════════ */

function showLogin() {
  document.getElementById('login-body').style.display = 'block';
  document.getElementById('reg-body').style.display = 'none';
  renderUserList();
  showPage('pg-login');
}

function showReg() {
  document.getElementById('login-body').style.display = 'none';
  document.getElementById('reg-body').style.display = 'block';
  showPage('pg-login');
  setTimeout(() => document.getElementById('reg-name').focus(), 100);
}

function renderUserList() {
  const el = document.getElementById('user-list');
  const users = Object.values(S.users);
  if (!users.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="19" cy="7" r="4"/><path d="M15 21v-2a4 4 0 014-4"/></svg>
      <p>No accounts yet.<br>Create one to get started.</p>
    </div>`;
    return;
  }
  el.innerHTML = users.map(u => {
    const total = (u.txns || []).reduce((a, t) => a + (t.amount || 0), 0);
    return `<div class="user-card" onclick="App.startPinLogin('${u.id}')">
      ${avatarEl(u.name, 40)}
      <div class="user-card-info">
        <div class="user-card-name">${u.name}</div>
        <div class="user-card-bal">${fmt(total)} saved</div>
      </div>
      <svg class="user-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}

let _loginTarget = null;

function startPinLogin(uid) {
  _loginTarget = uid;
  const u = S.users[uid];
  const av = document.getElementById('pin-avatar');
  av.innerHTML = initials(u.name);
  av.style.cssText = avatarCSS(u.name, 72);
  document.getElementById('pin-name').textContent = u.name;
  document.getElementById('pin-input').value = '';
  showPage('pg-pin');
  setTimeout(() => document.getElementById('pin-input').focus(), 100);
}

function verifyPin() {
  const pin = document.getElementById('pin-input').value;
  if (!_loginTarget || !S.users[_loginTarget]) { toast('User not found'); return; }
  if (S.users[_loginTarget].pin !== pin) { toast('Wrong PIN — try again'); return; }
  S.currentUid = _loginTarget;
  subscribeRealtime();
  showMain('mine');
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const pin  = document.getElementById('reg-pin').value.trim();
  if (!name)              { toast('Enter your name'); return; }
  if (!/^\d{4}$/.test(pin)) { toast('PIN must be 4 digits'); return; }
  const taken = Object.values(S.users).some(u => u.name.toLowerCase() === name.toLowerCase());
  if (taken)              { toast('Name already taken — choose another'); return; }

  const id = 'u' + Date.now();
  S.users[id] = { id, name, pin, txns: [], goal: 0 };
  await fbSaveUsers();
  S.currentUid = id;
  subscribeRealtime();
  showMain('mine');
  toast('Welcome, ' + name + '!');
}

function logout() {
  if (!confirm('Sign out of ' + curUser().name + '?')) return;
  if (S.unsubUsers)  S.unsubUsers();
  if (S.unsubJoints) S.unsubJoints();
  S.currentUid = null;
  showLogin();
}

/* ═══════════════════════════════════════
   HEADER
═══════════════════════════════════════ */

function renderHeader() {
  const u     = curUser();
  const total = myTotal();
  document.getElementById('header-name').textContent    = u.name;
  document.getElementById('header-balance').textContent = fmtShort(total);

  const av = document.getElementById('header-avatar');
  av.innerHTML  = initials(u.name);
  av.style.cssText = avatarCSS(u.name, 24);

  const goal = u.goal || 0;
  const pw   = document.getElementById('goal-progress-wrap');
  if (goal > 0) {
    pw.style.display = 'block';
    const pct = Math.min(100, Math.round(total / goal * 100));
    document.getElementById('goal-pct-label').textContent    = pct + '%';
    document.getElementById('goal-target-label').textContent = 'goal: ' + fmt(goal);
    document.getElementById('goal-progress-fill').style.width = pct + '%';
    document.getElementById('settings-goal-val').textContent  = fmt(goal);
    document.getElementById('goal-btn-txt') && (document.getElementById('goal-btn-txt').textContent = 'edit goal');
  } else {
    pw.style.display = 'none';
    document.getElementById('settings-goal-val').textContent = 'not set';
  }
}

/* ═══════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════ */

function switchTab(name, btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const activeBtn = btn || document.querySelector(`.nav-btn[data-tab="${name}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  populateTab(name);
}

function populateActiveTab() {
  const active = document.querySelector('.tab-panel.active');
  if (!active) return;
  populateTab(active.id.replace('tab-', ''));
}

function populateTab(name) {
  if (name === 'mine')     renderMine();
  else if (name === 'joint') renderJoint();
  else if (name === 'stats') renderStats();
  else if (name === 'add')   renderAddTarget();
}

/* ═══════════════════════════════════════
   MINE TAB
═══════════════════════════════════════ */

function renderMine() {
  const txns = [...myTxns()].reverse().slice(0, 30);
  const el   = document.getElementById('mine-txns');
  if (!txns.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <p>No deposits yet.<br>Tap + to add your first one.</p>
    </div>`;
    return;
  }
  el.innerHTML = txns.map(t => `
    <div class="txn-item">
      <div class="txn-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
      </div>
      <div class="txn-info">
        <div class="txn-desc">${t.desc || 'Deposit'}</div>
        <div class="txn-meta">${t.date}${t.from ? ' · via TNG scan' : ''}</div>
      </div>
      <div class="txn-amount">+${fmt(t.amount)}</div>
    </div>`).join('');
}

/* ═══════════════════════════════════════
   JOINT TAB
═══════════════════════════════════════ */

function renderJoint() {
  const joints = myJoints();
  const el     = document.getElementById('joint-list');
  if (!joints.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
      <p>No joint pots yet.<br>Create one to save with others.</p>
    </div>`;
    return;
  }
  el.innerHTML = joints.map(j => {
    const total   = (j.txns || []).reduce((a, t) => a + (t.amount || 0), 0);
    const names   = (j.members || []).map(id => S.users[id]?.name || '?');
    return `<div class="joint-card" onclick="App.openJointDetail('${j.id}')">
      <div class="joint-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="17" cy="9" r="3"/><path d="M21 21v-1.5a3 3 0 00-3-3h-1"/></svg>
      </div>
      <div class="joint-info">
        <div class="joint-name">${j.name}</div>
        <div class="joint-members">${names.join(', ')}</div>
      </div>
      <div class="joint-right">
        <div class="joint-amount">${fmt(total)}</div>
        <div class="joint-count">${j.members.length} members</div>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════
   ADD TAB
═══════════════════════════════════════ */

function renderAddTarget() {
  const sel    = document.getElementById('add-target');
  const joints = myJoints();
  sel.innerHTML = '<option value="me">my personal savings</option>' +
    joints.map(j => `<option value="${j.id}">${j.name} (joint)</option>`).join('');
}

async function addDeposit() {
  const amt    = parseFloat(document.getElementById('add-amt').value);
  const desc   = document.getElementById('add-desc').value.trim() || 'Deposit';
  const target = document.getElementById('add-target').value;
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }

  const txn = { id: 't' + Date.now(), amount: amt, desc, date: datestamp(), byId: S.currentUid, by: curUser().name };

  if (target === 'me') {
    S.users[S.currentUid].txns = [...(S.users[S.currentUid].txns || []), txn];
    await fbSaveUsers();
  } else {
    S.joints[target].txns = [...(S.joints[target].txns || []), txn];
    await fbSaveJoints();
  }

  document.getElementById('add-amt').value  = '';
  document.getElementById('add-desc').value = '';
  toast('Added ' + fmt(amt));
  renderHeader();
}

/* ═══════════════════════════════════════
   STATS TAB
═══════════════════════════════════════ */

function renderStats() {
  const txns  = myTxns();
  const total = myTotal();
  const n     = txns.length;
  const max   = n ? Math.max(...txns.map(t => t.amount)) : 0;
  const avg   = n ? total / n : 0;

  document.getElementById('st-total').textContent = fmt(total);
  document.getElementById('st-count').textContent = n;
  document.getElementById('st-max').textContent   = fmt(max);
  document.getElementById('st-avg').textContent   = fmt(avg);

  const el     = document.getElementById('st-joint');
  const joints = myJoints();
  if (!joints.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">No joint pots yet.</p>';
    return;
  }
  el.innerHTML = joints.map(j => {
    const jTotal = (j.txns || []).reduce((a, t) => a + (t.amount || 0), 0);
    const mine   = (j.txns || []).filter(t => t.byId === S.currentUid).reduce((a, t) => a + (t.amount || 0), 0);
    return `<div class="joint-card" onclick="App.openJointDetail('${j.id}')">
      <div class="joint-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></svg></div>
      <div class="joint-info"><div class="joint-name">${j.name}</div><div class="joint-members">my share: ${fmt(mine)}</div></div>
      <div class="joint-right"><div class="joint-amount">${fmt(jTotal)}</div><div class="joint-count">total</div></div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════
   GOAL SHEET
═══════════════════════════════════════ */

function openGoalSheet() {
  openSheet('savings goal', `
    <div class="field-group">
      <label class="field-label">target amount (RM)</label>
      <input class="field-input amount-input" id="m-goal" type="number" placeholder="0.00" value="${curUser().goal || ''}" />
    </div>
    <button class="btn-primary" onclick="App.saveGoal()">save goal</button>
    <button class="btn-ghost" onclick="App.closeSheet()">cancel</button>`);
}

async function saveGoal() {
  const v = parseFloat(document.getElementById('m-goal').value);
  if (!v || v <= 0) { toast('Enter a valid amount'); return; }
  S.users[S.currentUid].goal = v;
  await fbSaveUsers();
  closeSheet();
  renderHeader();
  toast('Goal set: ' + fmt(v));
}

/* ═══════════════════════════════════════
   CREATE JOINT POT
═══════════════════════════════════════ */

function openCreateJointSheet() {
  const others = Object.values(S.users).filter(u => u.id !== S.currentUid);
  const memberPicks = others.length
    ? others.map(u => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" value="${u.id}" style="width:18px;height:18px;accent-color:#3B82F6" />
          ${avatarEl(u.name, 30)}
          <span style="font-size:14px">${u.name}</span>
        </label>`).join('')
    : '<p style="font-size:13px;color:var(--text-muted);padding:8px 0">No other accounts yet. Invite friends to create accounts first.</p>';

  openSheet('create joint pot', `
    <div class="field-group">
      <label class="field-label">pot name</label>
      <input class="field-input" id="m-jname" placeholder="e.g. Trip to Japan" />
    </div>
    <div class="field-label" style="margin-bottom:8px">invite members</div>
    <div id="m-member-picks" style="margin-bottom:16px">${memberPicks}</div>
    <button class="btn-primary" onclick="App.createJoint()">create pot</button>
    <button class="btn-ghost" onclick="App.closeSheet()">cancel</button>`);
}

async function createJoint() {
  const name    = document.getElementById('m-jname').value.trim();
  if (!name) { toast('Enter a pot name'); return; }
  const checked = [...document.querySelectorAll('#m-member-picks input:checked')].map(c => c.value);
  const members = [S.currentUid, ...checked];
  const id      = 'j' + Date.now();
  S.joints[id]  = { id, name, members, txns: [], goal: 0 };
  await fbSaveJoints();
  closeSheet();
  renderJoint();
  renderAddTarget();
  toast('"' + name + '" created');
}

/* ═══════════════════════════════════════
   JOINT DETAIL
═══════════════════════════════════════ */

let S_curJoint = null;

function openJointDetail(jid) {
  S_curJoint = jid;
  renderJointDetail();
  showPage('pg-joint');
}

function renderJointDetail() {
  const j = S.joints[S_curJoint];
  if (!j) return;

  const total   = (j.txns || []).reduce((a, t) => a + (t.amount || 0), 0);
  const names   = (j.members || []).map(id => S.users[id]?.name || '?');
  document.getElementById('jd-name').textContent  = j.name;
  document.getElementById('jd-meta').textContent  = names.join(' · ');
  document.getElementById('jd-total').textContent = fmtShort(total);

  const goal = j.goal || 0;
  const gr   = document.getElementById('jd-goal-row');
  if (goal > 0) {
    gr.style.display = 'block';
    const pct = Math.min(100, Math.round(total / goal * 100));
    document.getElementById('jd-goal-pct').textContent    = pct + '%';
    document.getElementById('jd-goal-target').textContent = 'goal: ' + fmt(goal);
    document.getElementById('jd-goal-fill').style.width   = pct + '%';
  } else {
    gr.style.display = 'none';
  }

  /* Members */
  const mel = document.getElementById('jd-members');
  mel.innerHTML = (j.members || []).map(uid => {
    const u       = S.users[uid] || { name: '?' };
    const contrib = (j.txns || []).filter(t => t.byId === uid).reduce((a, t) => a + (t.amount || 0), 0);
    return `<div class="member-row">
      ${avatarEl(u.name, 34)}
      <div class="member-info">
        <div class="member-name">${u.name}${uid === S.currentUid ? ' <span style="font-size:10px;color:var(--blue-400)">(you)</span>' : ''}</div>
        <div class="member-contrib">${(j.txns || []).filter(t => t.byId === uid).length} deposits</div>
      </div>
      <div class="member-amount">${fmt(contrib)}</div>
    </div>`;
  }).join('');

  /* Transactions */
  const txns = [...(j.txns || [])].reverse().slice(0, 30);
  const tel  = document.getElementById('jd-txns');
  if (!txns.length) {
    tel.innerHTML = '<div class="empty-state"><p>No deposits yet.</p></div>';
    return;
  }
  tel.innerHTML = txns.map(t => `
    <div class="txn-item">
      ${avatarEl(t.by || '?', 34)}
      <div class="txn-info">
        <div class="txn-desc">${t.desc || 'Deposit'}</div>
        <div class="txn-meta">${t.by} · ${t.date}</div>
      </div>
      <div class="txn-amount">+${fmt(t.amount)}</div>
    </div>`).join('');
}

function openAddMemberSheet() {
  const j      = S.joints[S_curJoint];
  const others = Object.values(S.users).filter(u => !(j.members || []).includes(u.id));
  if (!others.length) { toast('All users are already members'); return; }
  openSheet('invite member', `
    <div>${others.map(u => `
      <div class="user-card" onclick="App.addMember('${u.id}')">
        ${avatarEl(u.name, 38)}
        <div class="user-card-info"><div class="user-card-name">${u.name}</div></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>`).join('')}
    </div>
    <button class="btn-ghost" style="margin-top:8px" onclick="App.closeSheet()">cancel</button>`);
}

async function addMember(uid) {
  S.joints[S_curJoint].members.push(uid);
  await fbSaveJoints();
  closeSheet();
  renderJointDetail();
  toast((S.users[uid]?.name || 'Member') + ' added');
}

function openJointGoalSheet() {
  const j = S.joints[S_curJoint];
  openSheet('joint pot goal', `
    <div class="field-group">
      <label class="field-label">combined savings target (RM)</label>
      <input class="field-input amount-input" id="m-jgoal" type="number" placeholder="0.00" value="${j.goal || ''}" />
    </div>
    <button class="btn-primary" onclick="App.saveJointGoal()">save goal</button>
    <button class="btn-ghost" onclick="App.closeSheet()">cancel</button>`);
}

async function saveJointGoal() {
  const v = parseFloat(document.getElementById('m-jgoal').value);
  if (!v || v <= 0) { toast('Enter a valid amount'); return; }
  S.joints[S_curJoint].goal = v;
  await fbSaveJoints();
  closeSheet();
  renderJointDetail();
  toast('Goal set: ' + fmt(v));
}

function openJointDepositSheet() {
  const j = S.joints[S_curJoint];
  openSheet('add to ' + j.name, `
    <div class="field-group">
      <label class="field-label">amount (RM)</label>
      <input class="field-input amount-input" id="m-jamt" type="number" placeholder="0.00" step="0.01" />
    </div>
    <div class="field-group">
      <label class="field-label">note (optional)</label>
      <input class="field-input" id="m-jdesc" placeholder="e.g. Monthly contribution" />
    </div>
    <button class="btn-primary" onclick="App.doJointDeposit()">add deposit</button>
    <button class="btn-ghost" onclick="App.closeSheet()">cancel</button>`);
}

async function doJointDeposit() {
  const amt  = parseFloat(document.getElementById('m-jamt').value);
  const desc = document.getElementById('m-jdesc').value.trim() || 'Deposit';
  if (!amt || amt <= 0) { toast('Enter a valid amount'); return; }
  const txn = { id: 't' + Date.now(), amount: amt, desc, date: datestamp(), byId: S.currentUid, by: curUser().name };
  S.joints[S_curJoint].txns = [...(S.joints[S_curJoint].txns || []), txn];
  await fbSaveJoints();
  closeSheet();
  renderJointDetail();
  renderHeader();
  toast('Added ' + fmt(amt));
}

async function leaveJoint() {
  const j = S.joints[S_curJoint];
  if (!confirm('Leave "' + j.name + '"? Your contributions will stay.')) return;
  S.joints[S_curJoint].members = j.members.filter(id => id !== S.currentUid);
  if (!S.joints[S_curJoint].members.length) delete S.joints[S_curJoint];
  await fbSaveJoints();
  showMain('joint');
  toast('Left the pot');
}

/* ═══════════════════════════════════════
   QR SCAN
═══════════════════════════════════════ */

function handleQR(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR ? window.jsQR(data.data, data.width, data.height) : null;
      if (code) applyQRResult(code.data);
      else toast('No QR found — enter amount manually');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function applyQRResult(text) {
  const amtM = text.match(/(?:amount|amt|RM|MYR)[:\s]*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const numM = text.match(/\b([0-9]{1,4}\.[0-9]{2})\b/);
  const amt  = amtM ? parseFloat(amtM[1]) : numM ? parseFloat(numM[1]) : null;
  if (!amt || amt <= 0) { toast('Could not read amount — enter manually'); return; }
  document.getElementById('add-amt').value  = amt.toFixed(2);
  document.getElementById('add-desc').value = 'TNG receipt';
  toast('Read ' + fmt(amt) + ' — confirm to add');
}

/* ═══════════════════════════════════════
   SETTINGS
═══════════════════════════════════════ */

async function clearMyData() {
  if (!confirm('Clear all your personal transactions and goal? Joint pot data is not affected.')) return;
  S.users[S.currentUid].txns = [];
  S.users[S.currentUid].goal = 0;
  await fbSaveUsers();
  renderHeader();
  renderMine();
  renderStats();
  toast('Data cleared');
}

/* ═══════════════════════════════════════
   BOTTOM SHEET
═══════════════════════════════════════ */

function openSheet(title, bodyHTML) {
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML    = bodyHTML;
  document.getElementById('sheet-overlay').classList.add('open');
}

function closeSheet(e) {
  if (e && e.target !== document.getElementById('sheet-overlay')) return;
  document.getElementById('sheet-overlay').classList.remove('open');
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */

let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ═══════════════════════════════════════
   BOOT
═══════════════════════════════════════ */

async function boot() {
  if (!window._fbReady) {
    await new Promise(r => document.addEventListener('fb-ready', r, { once: true }));
  }
  db = window._db;
  fs = window._fs;

  const [users, joints] = await Promise.all([fbGetUsers(), fbGetJoints()]);
  S.users  = users;
  S.joints = joints;

  showPage('pg-login');
  renderUserList();
}

/* Public API for inline onclick handlers */
window.App = {
  showLogin, showReg, register, startPinLogin, verifyPin, logout,
  switchTab, showMain,
  addDeposit, handleQR,
  openGoalSheet, saveGoal,
  openCreateJointSheet, createJoint,
  openJointDetail, renderJointDetail, openAddMemberSheet, addMember,
  openJointGoalSheet, saveJointGoal,
  openJointDepositSheet, doJointDeposit, leaveJoint,
  openSheet, closeSheet,
  clearMyData,
};

/* Load jsQR from CDN then boot */
const jsqrScript = document.createElement('script');
jsqrScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
jsqrScript.onload = boot;
jsqrScript.onerror = boot;
document.head.appendChild(jsqrScript);