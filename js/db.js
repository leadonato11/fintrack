// ============================================
// db.js — Conexión con Supabase
// Este archivo es el único que "habla" con la
// base de datos. El resto de la app no sabe
// si los datos vienen de Supabase, localStorage,
// o cualquier otro lado. Eso es bueno.
// ============================================

// Estas dos líneas traen la librería de Supabase
// desde internet (como un import de herramientas)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// TUS CREDENCIALES — reemplazá con las tuyas
const SUPABASE_URL = window._env?.SUPABASE_URL || ''
const SUPABASE_KEY = window._env?.SUPABASE_KEY || ''

// Creamos la conexión. "supabase" es el objeto
// que vamos a usar en toda la app para leer y
// escribir datos.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)


// ============================================
// TRANSACCIONES
// ============================================

// Trae todas las transacciones del mes actual
// para el usuario logueado
export async function getTransactions(userId, groupId, month, year) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .or(`user_id.eq.${userId},payer_id.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) { console.error('Error trayendo transacciones:', error); return [] }
  return data
}

// Guarda una nueva transacción
export async function saveTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([tx])
    .select()
    .single()

  if (error) { console.error('Error guardando transacción:', error); return null }
  return data
}

// Elimina una transacción por su ID
export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) { console.error('Error eliminando:', error); return false }
  return true
}


// ============================================
// GRUPOS
// ============================================

// Trae el grupo del usuario (su "pareja/familia")
export async function getUserGroup(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, groups(id, name)')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data
}

// Crea un grupo nuevo y agrega al usuario como primer miembro
export async function createGroup(userId) {
  // Primero creamos el grupo
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert([{ name: 'Mi grupo' }])
    .select()
    .single()

  if (groupError) { console.error('Error creando grupo:', groupError); return null }

  // Después agregamos al usuario a ese grupo
  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{ group_id: group.id, user_id: userId }])

  if (memberError) { console.error('Error agregando miembro:', memberError); return null }
  return group
}

// Busca un usuario por email para invitarlo al grupo
export async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, groups(id)')
    .eq('user_id', (
      await supabase.rpc('get_user_id_by_email', { email_input: email })
    ).data)
    .single()

  if (error) return null
  return data
}

// Agrega un usuario existente a un grupo
export async function addMemberToGroup(groupId, userId) {
  const { error } = await supabase
    .from('group_members')
    .insert([{ group_id: groupId, user_id: userId }])

  if (error) { console.error('Error invitando:', error); return false }
  return true
}

// Trae todos los miembros del grupo
export async function getGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  if (error) return []
  return data
}