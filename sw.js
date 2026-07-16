 // ============================================
// sw.js — Service Worker
//
// ¿Qué es un Service Worker?
// Es un script que el navegador corre en
// SEGUNDO PLANO, separado de la app.
// Actúa como un "intermediario" entre la app
// e internet. Puede interceptar requests,
// guardar archivos en caché, y hacer que
// la app funcione sin conexión.
//
// Pensalo como un empleado que trabaja
// aunque la oficina (la app) esté cerrada.
// ============================================

// Nombre del caché — si cambiás algo, cambiá
// este número para que los usuarios reciban
// la versión nueva
const CACHE_NAME = 'fintrack-v1'

// Archivos que queremos guardar para usar sin internet
const ARCHIVOS_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/db.js',
  '/manifest.json'
]

// ============================================
// EVENTO: install
// Se dispara cuando el Service Worker se
// instala por primera vez.
// Aprovechamos para guardar los archivos en caché.
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando...')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Guardando archivos en caché')
        return cache.addAll(ARCHIVOS_CACHE)
      })
      .then(() => {
        // Activarse inmediatamente sin esperar
        // a que el usuario cierre la app
        self.skipWaiting()
      })
  )
})

// ============================================
// EVENTO: activate
// Se dispara cuando el SW toma control.
// Aprovechamos para limpiar cachés viejos.
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Activado')

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          // Filtrar los cachés que NO son el actual
          .filter(key => key !== CACHE_NAME)
          // Borrarlos
          .map(key => {
            console.log('[SW] Borrando caché viejo:', key)
            return caches.delete(key)
          })
      )
    }).then(() => {
      // Tomar control de todas las pestañas abiertas
      self.clients.claim()
    })
  )
})

// ============================================
// EVENTO: fetch
// Se dispara con CADA request que hace la app
// (cargar una imagen, pedir datos, etc.)
//
// Estrategia: "Network First, Cache Fallback"
// 1. Intentar traer de internet (fresco)
// 2. Si no hay internet, usar lo guardado en caché
//
// Para los requests a Supabase usamos solo red
// porque son datos que cambian constantemente.
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Requests a Supabase: siempre desde la red
  // (nunca queremos datos desactualizados de la BD)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Resto de archivos: Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guardarla en caché
        if (response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Sin internet: buscar en caché
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached
            // Si no está en caché, devolver el index.html
            // para que la app igual arranque
            return caches.match('/index.html')
          })
      })
  )
})