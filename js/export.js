// ============================================
// export.js — Exportador de datos FinTrack
// Genera Excel y PDF del lado del cliente
// sin necesidad de servidor
// ============================================

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ============================================
// HELPERS
// ============================================
function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function nombreTipo(type) {
  const map = { income: 'Ingreso', expense: 'Gasto', shared: 'Compartido', saving: 'Ahorro' }
  return map[type] || type
}

// Filtrar transacciones por rango de fechas
function filtrarPorRango(txs, desde, hasta) {
  return txs.filter(t => {
    const fecha = new Date(t.year, t.month, 1)
    return fecha >= desde && fecha <= hasta
  })
}

// Calcular rango según período seleccionado
export function calcularRango(periodo, mesActual, anioActual, desdeCustom, hastaCustom) {
  const hoy = new Date(anioActual, mesActual, 1)
  let desde, hasta

  switch (periodo) {
    case 'mensual':
      desde = new Date(anioActual, mesActual, 1)
      hasta = new Date(anioActual, mesActual, 1)
      break
    case 'trimestral':
      desde = new Date(anioActual, mesActual - 2, 1)
      hasta = new Date(anioActual, mesActual, 1)
      break
    case 'semestral':
      desde = new Date(anioActual, mesActual - 5, 1)
      hasta = new Date(anioActual, mesActual, 1)
      break
    case 'anual':
      desde = new Date(anioActual, 0, 1)
      hasta = new Date(anioActual, 11, 1)
      break
    case 'personalizado':
      desde = desdeCustom
      hasta = hastaCustom
      break
    default:
      desde = hoy
      hasta = hoy
  }

  return { desde, hasta }
}

// ============================================
// EXPORTAR EXCEL
// ============================================
export async function exportarExcel(txs, groupMembers, userId, opciones) {
  // Cargar SheetJS dinámicamente
  if (!window.XLSX) {
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
  }

  const { desde, hasta, tipos } = opciones
  const txsFiltradas = filtrarPorRango(txs, desde, hasta)
    .filter(t => tipos.includes(t.type))

  const wb = window.XLSX.utils.book_new()

  // ---- Hoja 1: Resumen ----
  const resumen = calcularResumen(txsFiltradas, userId)
  const resumenData = [
    ['FinTrack — Resumen de gastos'],
    ['Período', `${MONTHS[desde.getMonth()]} ${desde.getFullYear()} — ${MONTHS[hasta.getMonth()]} ${hasta.getFullYear()}`],
    [''],
    ['Concepto', 'Monto'],
    ['Ingresos totales', resumen.ingresos],
    ['Gastos propios', resumen.gastos],
    ['Gastos compartidos (mi parte)', resumen.compartidos],
    ['Ahorros', resumen.ahorros],
    ['Saldo libre', resumen.saldo],
  ]
  const wsResumen = window.XLSX.utils.aoa_to_sheet(resumenData)
  wsResumen['!cols'] = [{ wch: 35 }, { wch: 20 }]
  window.XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ---- Hoja 2: Detalle ----
  const headers = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Pagador']
  const filas = txsFiltradas.map(t => {
    const pagador = t.payer_id === userId ? 'Yo' : nombreMiembro(t.payer_id, groupMembers)
    return [
      `${MONTHS[t.month]} ${t.year}`,
      nombreTipo(t.type),
      t.description || '—',
      t.category || '—',
      Number(t.amount),
      t.type === 'shared' ? pagador : '—'
    ]
  })

  const wsDetalle = window.XLSX.utils.aoa_to_sheet([headers, ...filas])
  wsDetalle['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }
  ]
  window.XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')

  // ---- Hoja 3: Por mes (si el rango es mayor a 1 mes) ----
  if (desde.getTime() !== hasta.getTime()) {
    const porMes = agruparPorMes(txsFiltradas, userId)
    const mesFila = [['Mes', 'Ingresos', 'Gastos', 'Compartido', 'Ahorros', 'Saldo']]
    Object.entries(porMes).forEach(([key, r]) => {
      mesFila.push([key, r.ingresos, r.gastos, r.compartidos, r.ahorros, r.saldo])
    })
    const wsMes = window.XLSX.utils.aoa_to_sheet(mesFila)
    wsMes['!cols'] = Array(6).fill({ wch: 16 })
    window.XLSX.utils.book_append_sheet(wb, wsMes, 'Por mes')
  }

  // Descargar
  const nombreArchivo = `FinTrack_${MONTHS[desde.getMonth()]}_${desde.getFullYear()}.xlsx`
  window.XLSX.writeFile(wb, nombreArchivo)
}

// ============================================
// EXPORTAR PDF
// ============================================
export async function exportarPDF(txs, groupMembers, userId, opciones) {
  // Cargar jsPDF dinámicamente
  if (!window.jspdf) {
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const { desde, hasta, tipos } = opciones
  const txsFiltradas = filtrarPorRango(txs, desde, hasta)
    .filter(t => tipos.includes(t.type))

  const resumen = calcularResumen(txsFiltradas, userId)
  const periodoStr = `${MONTHS[desde.getMonth()]} ${desde.getFullYear()} — ${MONTHS[hasta.getMonth()]} ${hasta.getFullYear()}`

  // ---- Header ----
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('FinTrack', 14, 16)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Reporte de gastos', 14, 24)
  doc.text(periodoStr, 14, 31)

  // ---- Tarjetas de resumen ----
  doc.setTextColor(26, 58, 92)
  const cards = [
    { label: 'Ingresos',    valor: resumen.ingresos,    color: [61, 190, 122] },
    { label: 'Gastos',      valor: resumen.gastos,      color: [224, 82, 82] },
    { label: 'Compartido',  valor: resumen.compartidos, color: [124, 111, 205] },
    { label: 'Saldo libre', valor: resumen.saldo,       color: [74, 139, 196] },
  ]

  const cardW = 44
  const cardX = 14
  const cardY = 42

  cards.forEach((card, i) => {
    const x = cardX + i * (cardW + 3)
    doc.setFillColor(...card.color)
    doc.roundedRect(x, cardY, cardW, 22, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(card.label, x + 3, cardY + 7)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(fmt(card.valor), x + 3, cardY + 16)
  })

  // ---- Tabla de transacciones ----
  doc.setTextColor(26, 58, 92)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de transacciones', 14, 76)

  const filas = txsFiltradas.map(t => {
    const pagador = t.payer_id === userId ? 'Yo' : nombreMiembro(t.payer_id, groupMembers)
    return [
      `${MONTHS[t.month].slice(0,3)} ${t.year}`,
      nombreTipo(t.type),
      (t.description || '—').slice(0, 30),
      t.category || '—',
      fmt(Number(t.amount)),
      t.type === 'shared' ? pagador : '—'
    ]
  })

  doc.autoTable({
    startY: 80,
    head: [['Período', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Pagador']],
    body: filas,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [26, 58, 92],
    },
    headStyles: {
      fillColor: [115, 172, 223],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [234, 244, 252],
    },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
  })

  // ---- Footer ----
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140, 170, 196)
    doc.text(
      `FinTrack — Generado el ${new Date().toLocaleDateString('es-AR')} — Página ${i} de ${pageCount}`,
      14, 290
    )
  }

  // Descargar
  const nombreArchivo = `FinTrack_${MONTHS[desde.getMonth()]}_${desde.getFullYear()}.pdf`
  doc.save(nombreArchivo)
}

// ============================================
// HELPERS INTERNOS
// ============================================
function calcularResumen(txs, userId) {
  let ingresos = 0, gastos = 0, compartidos = 0, ahorros = 0

  txs.forEach(t => {
    if (t.type === 'income' && t.user_id === userId) {
      ingresos += Number(t.amount)
    } else if (t.type === 'expense' && t.user_id === userId) {
      gastos += Number(t.amount)
    } else if (t.type === 'shared') {
      const iAmPayer = t.payer_id === userId
      const involved = t.user_id === userId || t.payer_id === userId || t.partner_id === userId
      if (!involved) return
      const myPart = iAmPayer
        ? Number(t.amount) * Number(t.my_pct) / 100
        : Number(t.amount) * Number(t.partner_pct) / 100
      compartidos += myPart
    } else if (t.type === 'saving' && t.user_id === userId) {
      ahorros += Number(t.amount)
    }
  })

  const saldo = Math.max(0, ingresos - gastos - compartidos - ahorros)
  return { ingresos, gastos, compartidos, ahorros, saldo }
}

function agruparPorMes(txs, userId) {
  const meses = {}
  txs.forEach(t => {
    const key = `${MONTHS[t.month]} ${t.year}`
    if (!meses[key]) meses[key] = { ingresos:0, gastos:0, compartidos:0, ahorros:0, saldo:0 }
    const r = meses[key]
    if (t.type === 'income' && t.user_id === userId) r.ingresos += Number(t.amount)
    else if (t.type === 'expense' && t.user_id === userId) r.gastos += Number(t.amount)
    else if (t.type === 'shared') {
      const iAmPayer = t.payer_id === userId
      const involved = t.user_id === userId || t.payer_id === userId || t.partner_id === userId
      if (!involved) return
      const myPart = iAmPayer
        ? Number(t.amount) * Number(t.my_pct) / 100
        : Number(t.amount) * Number(t.partner_pct) / 100
      r.compartidos += myPart
    } else if (t.type === 'saving' && t.user_id === userId) {
      r.ahorros += Number(t.amount)
    }
  })
  Object.keys(meses).forEach(k => {
    const r = meses[k]
    r.saldo = Math.max(0, r.ingresos - r.gastos - r.compartidos - r.ahorros)
  })
  return meses
}

function nombreMiembro(uid, groupMembers) {
  if (!uid) return '—'
  const m = groupMembers.find(m => m.id === uid)
  return m?.name || m?.email?.split('@')[0] || 'Usuario'
}

function cargarScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = url
    s.onload  = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}