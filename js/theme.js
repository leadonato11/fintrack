// ============================================
// theme.js — Modo oscuro/claro y días especiales
// ============================================

// Días especiales argentinos + cumpleaños Lea
const DIAS_ESPECIALES = [
  // Formato: { mes (1-12), dia, clase, emoji, nombre }
  { mes: 1,  dia: 1,  clase: 'special-newyear',  emoji: '🎆', nombre: '¡Feliz Año Nuevo!' },
  { mes: 2,  dia: 16, clase: 'special-carnaval',  emoji: '🎭', nombre: '¡Carnaval!' },
  { mes: 2,  dia: 17, clase: 'special-carnaval',  emoji: '🎭', nombre: '¡Carnaval!' },
  { mes: 3,  dia: 24, clase: 'special-solemne',   emoji: '🕊️', nombre: 'Día de la Memoria' },
  { mes: 4,  dia: 2,  clase: 'special-solemne',   emoji: '🇦🇷', nombre: 'Día de Malvinas' },
  { mes: 5,  dia: 1,  clase: 'special-patria',    emoji: '✊', nombre: 'Día del Trabajo' },
  { mes: 5,  dia: 25, clase: 'special-patria',    emoji: '🇦🇷', nombre: '25 de Mayo' },
  { mes: 6,  dia: 20, clase: 'special-patria',    emoji: '🇦🇷', nombre: 'Día de la Bandera' },
  { mes: 7,  dia: 9,  clase: 'special-patria',    emoji: '🇦🇷', nombre: 'Día de la Independencia' },
  { mes: 8,  dia: 12, clase: 'special-cumple',    emoji: '🎂', nombre: '¡Feliz cumple, Lea! 🎉' },
  { mes: 8,  dia: 17, clase: 'special-patria',    emoji: '⚔️', nombre: 'Día de San Martín' },
  { mes: 10, dia: 12, clase: 'special-patria',    emoji: '🌎', nombre: 'Día de la Diversidad' },
  { mes: 11, dia: 20, clase: 'special-patria',    emoji: '🇦🇷', nombre: 'Soberanía Nacional' },
  { mes: 12, dia: 8,  clase: 'special-patria',    emoji: '✨', nombre: 'Inmaculada Concepción' },
  { mes: 12, dia: 24, clase: 'special-navidad',   emoji: '🎄', nombre: '¡Nochebuena!' },
  { mes: 12, dia: 25, clase: 'special-navidad',   emoji: '🎅', nombre: '¡Feliz Navidad!' },
  { mes: 12, dia: 31, clase: 'special-newyear2',  emoji: '🥂', nombre: '¡Feliz Fin de Año!' },
]

// ============================================
// TEMA — claro / oscuro / automático
// ============================================
export function initTheme() {
  const saved = localStorage.getItem('ft_theme') || 'auto'
  applyTheme(saved)
  updateThemeBtns(saved)

  // Si es automático, revisar cada minuto
  if (saved === 'auto') {
    setInterval(() => applyTheme('auto'), 60000)
  }
}

export function applyTheme(mode) {
  const hora = new Date().getHours()
  const esDark = mode === 'dark' || (mode === 'auto' && (hora >= 20 || hora < 7))
  document.documentElement.setAttribute('data-theme', esDark ? 'dark' : 'light')
  localStorage.setItem('ft_theme', mode)
  updateThemeBtns(mode)
}

function updateThemeBtns(mode) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
}

// ============================================
// DÍAS ESPECIALES
// ============================================
export function checkDiaEspecial() {
  const hoy  = new Date()
  const mes  = hoy.getMonth() + 1
  const dia  = hoy.getDate()

  // Limpiar clases anteriores
  DIAS_ESPECIALES.forEach(d => document.body.classList.remove(d.clase))

  const especial = DIAS_ESPECIALES.find(d => d.mes === mes && d.dia === dia)
  if (!especial) return

  // Aplicar clase al body
  document.body.classList.add(especial.clase)

  // Mostrar emoji en el header
  const hGreet = document.getElementById('hGreet')
  if (hGreet && !hGreet.querySelector('.header-special-emoji')) {
    const span = document.createElement('span')
    span.className = 'header-special-emoji'
    span.textContent = especial.emoji
    hGreet.appendChild(span)
  }

  // Toast especial al entrar
  setTimeout(() => {
    const notif = document.getElementById('notif')
    if (notif) {
      notif.textContent = especial.emoji + ' ' + especial.nombre
      notif.classList.add('show')
      setTimeout(() => notif.classList.remove('show'), 4000)
    }
  }, 1500)
}