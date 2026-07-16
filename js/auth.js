// ============================================
// auth.js — Autenticación con Supabase
// Este archivo maneja quién está logueado.
// No sabe nada de la UI, solo de usuarios.
// ============================================

import { supabase } from './db.js'
import { createGroup, getUserGroup } from './db.js'

// ============================================
// REGISTRO
// Crea un usuario nuevo con email y contraseña
// ============================================
export async function register(name, email, password) {
  // 1. Crear el usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name } // guardamos el nombre en el perfil
    }
  })

  if (error) return { ok: false, message: traducirError(error.message) }

  const userId = data.user.id

  // 2. Crear un grupo propio para este usuario
  // (cuando invite a alguien, ese alguien entra a este grupo)
  await createGroup(userId)

  return { ok: true, user: data.user }
}

// ============================================
// LOGIN con email y contraseña
// ============================================
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) return { ok: false, message: traducirError(error.message) }
  return { ok: true, user: data.user }
}

// ============================================
// LOGIN con Google
// Abre el popup de Google y Supabase maneja todo
// ============================================
export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin // vuelve a tu app después del login
    }
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ============================================
// LOGOUT
// ============================================
export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error cerrando sesión:', error)
}

// ============================================
// SESIÓN ACTUAL
// Devuelve el usuario logueado, o null si no hay
// Esta función se llama al cargar la app para
// saber si el usuario ya estaba logueado antes
// ============================================
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null

  const user = data.session.user
  const group = await getUserGroup(user.id)

  // Devolvemos un objeto limpio con lo que necesita la app
  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.email.split('@')[0],
    email: user.email,
    groupId: group?.group_id || null
  }
}

// ============================================
// ESCUCHAR CAMBIOS DE SESIÓN
// Supabase puede avisarnos cuando el usuario
// se loguea o desloguea (por ejemplo, si abre
// la app en otra pestaña)
// ============================================
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

// ============================================
// HELPER — Traducir errores de Supabase al español
// Supabase devuelve errores en inglés por defecto
// ============================================
function traducirError(msg) {
  const errores = {
    'Invalid login credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Confirmá tu email antes de ingresar',
    'User already registered': 'Ese email ya está registrado',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'Unable to validate email address: invalid format': 'El formato del email no es válido'
  }
  return errores[msg] || msg
}