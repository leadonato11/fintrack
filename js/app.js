// ============================================
// app.js — Lógica principal de la app
// Este archivo conecta la UI (lo que ve el
// usuario) con los datos (Supabase).
// ============================================

import { login, register, loginWithGoogle, logout, getSession, onAuthChange } from './auth.js'
import { getTransactions, saveTransaction, deleteTransaction, getUserGroup, getGroupMembers, createGroup, addMemberToGroup } from './db.js'

// ============================================
// ESTADO GLOBAL
// Una sola variable que tiene todo lo que
// la app necesita saber en cada momento.
// ============================================
const state = {
  user: null,          // usuario logueado
  group: null,         // su grupo (pareja/familia)
  groupMembers: [],    // miembros del grupo
  transactions: [],    // transacciones del mes
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  selectedType: 'income',
  pctMode: false
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                'Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ============================================
// INICIALIZACIÓN
// Lo primero que corre cuando carga la app
// ============================================
async function init() {
  mostrarCargando(true)

  // ¿Hay alguien logueado?
  const session = await getSession()

  if (session) {
    state.user = session
    await cargarGrupo()
    entrarApp()
  } else {
    mostrarPantalla('loginScreen')
  }

  mostrarCargando(false)

  // Escuchar si la sesión cambia (login con Google
  // redirige de vuelta a la app y esto lo detecta)
  onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const s = await getSession()
      if (s) {
        state.user = s
        await cargarGrupo()
        entrarApp()
      }
    }
    if (event === 'SIGNED_OUT') {
      mostrarPantalla('loginScreen')
    }
  })
}

// ============================================
// GRUPO
// ============================================
async function cargarGrupo() {
  const g = await getUserGroup(state.user.id)
  if (g) {
    state.group = g
    state.user.groupId = g.group_id
    const members = await getGroupMembers(g.group_id)
    state.groupMembers = members.map(m => m.user_id)
  } else {
    // Si no tiene grupo, crearle uno
    const newGroup = await createGroup(state.user.id)
    if (newGroup) {
      state.group = { group_id: newGroup.id }
      state.user.groupId = newGroup.id
    }
  }
}

// ============================================
// PANTALLAS
// ============================================
function mostrarPantalla(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id)?.classList.add('active')
}

function entrarApp() {
  mostrarPantalla('mainScreen')
  showTab('income')
  renderAll()
}

function mostrarCargando(si) {
  document.getElementById('loadingScreen')?.classList.toggle('active', si)
}

// ============================================
// TABS
// ============================================
window.showTab = function(name) {
  document.querySelectorAll('.titem').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tpanel').forEach(p => p.classList.remove('active'))
  document.getElementById('ti-' + name)?.classList.add('active')
  document.getElementById('p-' + name)?.classList.add('active')
  document.getElementById('fabBtn').style.display = name === 'settings' ? 'none' : 'flex'
  if (name === 'savings') renderSavings()
}

// ============================================
// CAMBIO DE MES
// ============================================
window.chMonth = async function(dir) {
  state.month += dir
  if (state.month < 0) { state.month = 11; state.year-- }
  if (state.month > 11) { state.month = 0; state.year++ }
  await recargarTransacciones()
}

async function recargarTransacciones() {
  if (!state.user) return
  state.transactions = await getTransactions(
    state.user.id,
    state.user.groupId,
    state.month,
    state.year
  )
  renderAll()
}

// ============================================
// CÁLCULOS
// ============================================
function calcSummary() {
  const uid = state.user?.id
  let inc = 0, exp = 0, sh = 0

  state.transactions.forEach(t => {
    if (t.type === 'income' && t.user_id === uid) inc += Number(t.amount)
    else if (t.type === 'expense' && t.user_id === uid) exp += Number(t.amount)
    else if (t.type === 'shared') {
      const iAmPayer = t.payer_id === uid
      const involved = t.user_id === uid || t.payer_id === uid || t.partner_id === uid
      if (!involved) return
      const myPart = iAmPayer
        ? Number(t.amount) * Number(t.my_pct) / 100
        : Number(t.amount) * Number(t.partner_pct) / 100
      sh += myPart
      if (!iAmPayer) exp += myPart
    }
  })
  return { inc, exp, sh }
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
}

// ============================================
// RENDER PRINCIPAL
// ============================================
function renderAll() {
  updateSummary()
  renderIncome()
  renderExpense()
  renderShared()
  renderSavings()
  renderSettings()
}

function updateSummary() {
  const { inc, exp, sh } = calcSummary()
  const sv = state.transactions
    .filter(t => t.type === 'saving' && t.user_id === state.user?.id)
    .reduce((s, t) => s + Number(t.amount), 0)
  const bal = Math.max(0, inc - exp - sh - sv)

  document.getElementById('sInc').textContent = fmt(inc)
  document.getElementById('sExp').textContent = fmt(exp)
  document.getElementById('sSh').textContent = fmt(sh)
  document.getElementById('sBal').textContent = fmt(bal)
  document.getElementById('mLabel').textContent = MONTHS[state.month] + ' ' + state.year
  document.getElementById('hDate').textContent = MONTHS[state.month].toLowerCase() + ' ' + state.year
}

// ============================================
// RENDER LISTAS
// ============================================
function renderIncome() {
  const txs = state.transactions
    .filter(t => t.type === 'income' && t.user_id === state.user?.id)
  document.getElementById('incList').innerHTML =
    txs.length ? txs.map(t => txCard(t, 'income')).join('') : empty('No hay ingresos este mes')
}

function renderExpense() {
  const txs = state.transactions
    .filter(t => t.type === 'expense' && t.user_id === state.user?.id)
  document.getElementById('expList').innerHTML =
    txs.length ? txs.map(t => txCard(t, 'expense')).join('') : empty('No hay gastos este mes')
}

function renderShared() {
  const uid = state.user?.id
  const txs = state.transactions.filter(t =>
    t.type === 'shared' &&
    (t.user_id === uid || t.payer_id === uid || t.partner_id === uid)
  )

  // Calcular quién le debe a quién
  let debts = {}
  txs.forEach(t => {
    const iAmPayer = t.payer_id === uid
    const partnerPart = Number(t.amount) * Number(t.partner_pct) / 100
    const myPart = Number(t.amount) * Number(t.my_pct) / 100
    const pid = iAmPayer ? t.partner_id : t.payer_id
    if (!pid) return
    debts[pid] = (debts[pid] || 0) + (iAmPayer ? partnerPart : -myPart)
  })

  // Mostrar banner de deudas
  let debtHtml = Object.entries(debts).map(([pid, amt]) => {
    const name = nombreDeUsuario(pid)
    if (Math.round(Math.abs(amt)) === 0) return ''
    return `<div class="drow">
      ${amt > 0
        ? `<span>${esc(name)} te debe</span><span style="color:var(--accent)">${fmt(Math.abs(amt))}</span>`
        : `<span>Debés a ${esc(name)}</span><span style="color:var(--danger)">${fmt(Math.abs(amt))}</span>`
      }
    </div>`
  }).join('')

  document.getElementById('dbtSum').innerHTML = debtHtml
    ? `<div class="dbtbanner"><div class="dtit">Balance del mes</div>${debtHtml}</div>` : ''
  document.getElementById('shList').innerHTML =
    txs.length ? txs.map(t => sharedCard(t)).join('') : empty('No hay gastos compartidos este mes')
}

let svChart = null
function renderSavings() {
  const uid = state.user?.id
  const svTxs = state.transactions.filter(t => t.type === 'saving' && t.user_id === uid)
  const { inc, exp, sh } = calcSummary()
  const intencional = svTxs.reduce((s, t) => s + Number(t.amount), 0)
  const auto = Math.max(0, inc - exp - sh - intencional)
  const total = intencional + auto
  const pct = inc > 0 ? Math.min(100, Math.round(total / inc * 100)) : 0

  document.getElementById('svSum').innerHTML = `
    <div class="sgcard">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      <div class="sginfo">
        <div class="sglbl">Ahorros del mes</div>
        <div class="sgval">${fmt(total)}</div>
        <div class="pbar"><div class="pfill" style="width:${pct}%"></div></div>
      </div>
      <span style="font-size:18px;font-weight:500;color:var(--blue)">${pct}%</span>
    </div>
    <div class="cwrap">
      <div style="font-size:13px;font-weight:500;color:var(--text2);margin-bottom:8px">Distribución del ingreso</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text2);margin-bottom:8px">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#D85A30;margin-right:4px"></span>Gastos</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#534AB7;margin-right:4px"></span>Compartido</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#1D9E75;margin-right:4px"></span>Ahorrado</span>
      </div>
      <div style="position:relative;height:160px">
        <canvas id="svChart"></canvas>
      </div>
    </div>
    <p class="stitle">Ahorros intencionales</p>`

  const ctx = document.getElementById('svChart')
  if (ctx) {
    if (svChart) { svChart.destroy(); svChart = null }
    svChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Gastos', 'Compartido', 'Ahorrado'],
        datasets: [{
          data: [Math.max(0, exp), Math.max(0, sh), Math.max(0, total)],
          backgroundColor: ['#D85A30', '#534AB7', '#1D9E75'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '65%'
      }
    })
  }

  document.getElementById('svList').innerHTML =
    svTxs.length ? svTxs.map(t => txCard(t, 'saving')).join('') : empty('Marcá un ahorro con el botón +')
}

function renderSettings() {
  const u = state.user
  if (!u) return
  document.getElementById('sName').textContent = u.name
  document.getElementById('sEmail').textContent = u.email

  const av = document.getElementById('uAvatar')
  av.textContent = iniciales(u.name)
  av.style.background = colorAvatar(u.name)
  document.getElementById('hGreet').textContent = 'Hola, ' + u.name.split(' ')[0] + ' 👋'

  // Mostrar miembros del grupo
  document.getElementById('uList').innerHTML = state.groupMembers.length > 1
    ? state.groupMembers.map(uid => {
        const name = nombreDeUsuario(uid)
        const esYo = uid === state.user.id
        return `<div class="urow">
          <div class="avatar" style="background:${colorAvatar(name)};width:36px;height:36px;font-size:13px">${iniciales(name)}</div>
          <div class="uinfo"><div class="uname">${esc(name)}</div></div>
          <span class="ubadge ${esYo ? 'bme' : 'bother'}">${esYo ? 'Vos' : 'Grupo'}</span>
        </div>`
      }).join('')
    : '<p style="font-size:13px;color:var(--text2)">Todavía no invitaste a nadie.</p>'
}

// ============================================
// TARJETAS DE TRANSACCIONES
// ============================================
const CAT_SVG = {
  general: '<circle cx="12" cy="12" r="3"/>',
  alimentacion: '<path d="M6 2v20M18 2a4 4 0 0 1 0 8H6"/>',
  transporte: '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  servicios: '<path d="M9 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/><polyline points="12 10 17 6 12 2"/><line x1="17" y1="6" x2="17" y2="20"/><line x1="21" y1="15" x2="13" y2="15"/>',
  salud: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  entretenimiento: '<polygon points="5 3 19 12 5 21 5 3"/>',
  educacion: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ropa: '<path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46C6.56 3.89 6 4.72 6 5.64V20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5.64c0-.92-.56-1.75-1.62-2.18z"/>',
  sueldo: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  freelance: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  otros: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'
}

function catSvg(cat, color) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CAT_SVG[cat] || CAT_SVG.general}</svg>`
}

function txCard(t, type) {
  const cls = type === 'income' ? 'in' : type === 'saving' ? 'sv' : 'ex'
  const color = type === 'income' ? '#0F6E56' : type === 'saving' ? '#185FA5' : '#D85A30'
  const sign = type === 'income' ? '+' : type === 'saving' ? '' : '−'
  const vc = type === 'income' ? 'v-green' : type === 'saving' ? 'v-blue' : 'v-red'
  const canDel = t.user_id === state.user?.id
  return `<div class="txi">
    <div class="txico ${cls}">${catSvg(t.category, color)}</div>
    <div class="txbody">
      <div class="txtit">${esc(t.description || t.category)}</div>
      <div class="txsub">${esc(t.category)} · ${MONTHS[t.month].slice(0,3)}</div>
    </div>
    <div>
      <div class="txamt ${vc}">${sign}${fmt(Number(t.amount))}</div>
      ${canDel ? `<button class="txdel" onclick="delTx('${t.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>` : ''}
    </div>
  </div>`
}

function sharedCard(t) {
  const uid = state.user?.id
  const iAmPayer = t.payer_id === uid
  const partnerId = iAmPayer ? t.partner_id : t.payer_id
  const partnerName = nombreDeUsuario(partnerId)
  const myPart = iAmPayer
    ? Number(t.amount) * Number(t.my_pct) / 100
    : Number(t.amount) * Number(t.partner_pct) / 100
  const paidBy = iAmPayer ? 'Pagaste vos' : `Pagó ${esc(partnerName)}`
  const canDel = t.user_id === uid || t.payer_id === uid

  return `<div class="txi">
    <div class="txico sh">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
    <div class="txbody">
      <div class="txtit">${esc(t.description || t.category)}</div>
      <div class="txsub">${paidBy} · Total ${fmt(Number(t.amount))} · Tu parte ${fmt(myPart)}</div>
    </div>
    <div>
      <div class="txamt v-purple">${fmt(Number(t.amount))}</div>
      ${canDel ? `<button class="txdel" onclick="delTx('${t.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>` : ''}
    </div>
  </div>`
}

function empty(msg) {
  return `<div class="empty">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:.2;margin:0 auto"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
    <p>${msg}</p>
  </div>`
}

// ============================================
// MODAL — AGREGAR TRANSACCIÓN
// ============================================
window.openAdd = function() {
  selType('income')
  document.getElementById('txAmt').value = ''
  document.getElementById('txDesc').value = ''
  document.getElementById('txCat').value = 'general'
  state.pctMode = false
  document.getElementById('pctSw').classList.remove('on')
  document.getElementById('pctF').classList.remove('show')
  document.getElementById('pct1').value = 50
  document.getElementById('pct2').value = 50
  popularSocios()
  document.getElementById('addModal').classList.add('open')
}

window.closeM = function(id) {
  document.getElementById(id).classList.remove('open')
}

function popularSocios() {
  const uid = state.user?.id
  const peers = state.groupMembers.filter(id => id !== uid)

  document.getElementById('txPartner').innerHTML = peers.length
    ? peers.map(id => `<option value="${id}">${esc(nombreDeUsuario(id))}</option>`).join('')
    : '<option value="">Sin compañeros aún</option>'

  document.getElementById('txPayer').innerHTML = [uid, ...peers].map(id =>
    `<option value="${id}">${esc(id === uid ? state.user.name : nombreDeUsuario(id))}</option>`
  ).join('')

  document.getElementById('pLbl1').textContent = (state.user?.name || 'Vos') + ' (%)'
  if (peers[0]) document.getElementById('pLbl2').textContent = nombreDeUsuario(peers[0]) + ' (%)'
}

window.selType = function(type) {
  state.selectedType = type
  ;['income','expense','shared','saving'].forEach(t => {
    const b = document.getElementById('b' + t[0].toUpperCase() + t.slice(1))
    if (b) b.className = 'tbtn' + (t === type ? ' t-' + t : '')
  })
  document.getElementById('shFields').style.display = type === 'shared' ? 'block' : 'none'
}

window.togPct = function() {
  state.pctMode = !state.pctMode
  document.getElementById('pctSw').classList.toggle('on', state.pctMode)
  document.getElementById('pctF').classList.toggle('show', state.pctMode)
}

document.getElementById('pct1')?.addEventListener('input', function() {
  document.getElementById('pct2').value = 100 - Math.min(100, Math.max(0, parseInt(this.value) || 0))
})

window.saveTx = async function() {
  const amount = parseFloat(document.getElementById('txAmt').value)
  const desc = document.getElementById('txDesc').value.trim()
  const cat = document.getElementById('txCat').value
  const type = state.selectedType

  if (!amount || amount <= 0) { notify('Ingresá un monto válido'); return }

  const tx = {
    type,
    amount,
    description: desc,
    category: cat,
    user_id: state.user.id,
    group_id: state.user.groupId,
    month: state.month,
    year: state.year,
    my_pct: 50,
    partner_pct: 50
  }

  if (type === 'shared') {
    const partnerId = document.getElementById('txPartner').value
    const payerId = document.getElementById('txPayer').value
    if (!partnerId) { notify('No hay compañeros en el grupo todavía'); return }
    tx.partner_id = partnerId
    tx.payer_id = payerId
    if (state.pctMode) {
      tx.my_pct = Math.min(100, Math.max(0, parseInt(document.getElementById('pct1').value) || 50))
      tx.partner_pct = 100 - tx.my_pct
    }
  }

  const saved = await saveTransaction(tx)
  if (!saved) { notify('Error al guardar. Intentá de nuevo.'); return }

  state.transactions.unshift(saved)
  closeM('addModal')
  renderAll()
  notify('¡Guardado! ✓')
  showTab({ income:'income', expense:'expense', shared:'shared', saving:'savings' }[type] || 'income')
}

window.delTx = async function(id) {
  const ok = await deleteTransaction(id)
  if (!ok) { notify('Error al eliminar'); return }
  state.transactions = state.transactions.filter(t => t.id !== id)
  renderAll()
  notify('Eliminado')
}

// ============================================
// AUTH HANDLERS (conectan botones con auth.js)
// ============================================
window.switchAuthTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0) === (tab === 'login'))
  )
  document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none'
  document.getElementById('registerForm').style.display = tab === 'register' ? 'flex' : 'none'
}

window.doLogin = async function() {
  const email = document.getElementById('lEmail').value.trim().toLowerCase()
  const pass = document.getElementById('lPass').value
  const err = document.getElementById('lErr')
  err.textContent = ''

  const result = await login(email, pass)
  if (!result.ok) { err.textContent = result.message; return }

  state.user = await getSession()
  await cargarGrupo()
  entrarApp()
}

window.doRegister = async function() {
  const name = document.getElementById('rName').value.trim()
  const email = document.getElementById('rEmail').value.trim().toLowerCase()
  const pass = document.getElementById('rPass').value
  const err = document.getElementById('rErr')
  err.textContent = ''

  const result = await register(name, email, pass)
  if (!result.ok) { err.textContent = result.message; return }

  err.textContent = ''
  notify('¡Cuenta creada! Revisá tu email para confirmar.')
}

window.doGoogle = async function() {
  await loginWithGoogle()
  // La redirección la maneja onAuthChange automáticamente
}

window.doLogout = async function() {
  await logout()
  state.user = null
  state.transactions = []
  state.groupMembers = []
  mostrarPantalla('loginScreen')
}

window.showInvite = function() {
  document.getElementById('invEmail').value = ''
  document.getElementById('invErr').textContent = ''
  document.getElementById('invModal').classList.add('open')
}

window.doInvite = async function() {
  notify('Función de invitar próximamente')
  closeM('invModal')
}

// ============================================
// HELPERS
// ============================================
function notify(msg) {
  const el = document.getElementById('notif')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

function iniciales(name) {
  return String(name).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#1D9E75','#534AB7','#D85A30','#185FA5','#BA7517']
function colorAvatar(name) {
  let h = 0
  for (let c of String(name)) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(h)]
}

// Por ahora devuelve el ID hasta que tengamos perfiles completos
function nombreDeUsuario(uid) {
  if (uid === state.user?.id) return state.user.name
  return uid?.slice(0, 8) + '...'
}

// ============================================
// ARRANCAR
// ============================================
init()