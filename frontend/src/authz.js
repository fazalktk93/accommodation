// frontend/src/authz.js
import { api } from './api'

let me = null

export async function loadMe() {
  try {
    const { data } = await api.get('/auth/me')
    me = data
  } catch {
    me = null
  }
  return me
}

export function currentUser() { return me }

export function hasPerm(p) {
  const list = (me?.permissions || [])
  return Array.isArray(list) && list.includes(p)
}
export function hasAny(...ps) {
  const list = (me?.permissions || [])
  return ps.some(p => list.includes(p))
}
