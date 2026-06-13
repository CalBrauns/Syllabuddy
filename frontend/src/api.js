const BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function getClasses() {
  const r = await fetch(`${BASE}/classes`)
  return r.json()
}

export async function deleteClass(id) {
  await fetch(`${BASE}/classes/${id}`, { method: 'DELETE' })
}

export async function uploadSyllabus(file) {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!r.ok) {
    const text = await r.text()
    let detail = 'Upload failed'
    try { detail = JSON.parse(text).detail } catch { detail = text.slice(0, 200) }
    throw new Error(detail)
  }
  return r.json()
}

export async function getPlan(weekStart) {
  const qs = weekStart ? `?week_start=${weekStart}` : ''
  const r = await fetch(`${BASE}/plan${qs}`)
  return r.json()
}

export async function getLimits() {
  const r = await fetch(`${BASE}/plan/limits`)
  return r.json()
}

export async function startCheckout() {
  const r = await fetch(`${BASE}/upgrade/checkout`, { method: 'POST' })
  if (!r.ok) {
    const text = await r.text()
    let detail = 'Checkout failed'
    try { detail = JSON.parse(text).detail } catch { detail = text.slice(0, 200) }
    throw new Error(detail)
  }
  const { url } = await r.json()
  window.location.href = url
}

export async function getSidebarTasks(classId) {
  const r = await fetch(`${BASE}/tasks/sidebar/${classId}`)
  return r.json()
}

export async function toggleTask(id) {
  const r = await fetch(`${BASE}/tasks/${id}/toggle`, { method: 'POST' })
  return r.json()
}

export async function deleteTask(id) {
  await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' })
}

export async function createTask(fields) {
  const r = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!r.ok) {
    const text = await r.text()
    let detail = 'Failed to create task'
    try { detail = JSON.parse(text).detail } catch { detail = text.slice(0, 200) }
    throw new Error(detail)
  }
  return r.json()
}

export async function updateTask(id, fields) {
  const r = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  return r.json()
}
