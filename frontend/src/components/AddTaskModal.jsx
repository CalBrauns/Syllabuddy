import { useState } from 'react'
import { createTask } from '../api'

const TASK_TYPES = ['assignment', 'exam', 'project', 'quiz', 'reading', 'other']

const TYPE_COLORS = {
  exam:       '#ef4444',
  assignment: '#3b82f6',
  project:    '#a855f7',
  quiz:       '#f97316',
  reading:    '#22c55e',
  other:      '#6b7280',
}

export default function AddTaskModal({ classes, onClose, onRefresh }) {
  const [fields, setFields] = useState({
    class_id: classes[0]?.id ?? '',
    title: '',
    type: 'assignment',
    due_date: '',
    estimated_hours: 1.0,
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fields.title.trim() || !fields.due_date || !fields.class_id) {
      setError('Title, class, and due date are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createTask({
        ...fields,
        class_id: Number(fields.class_id),
        estimated_hours: Number(fields.estimated_hours),
      })
      onRefresh()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const accentColor = TYPE_COLORS[fields.type] || '#6b7280'
  const inputCls = 'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-gray-600 transition'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-gray-950 border-0 md:border border-gray-800 rounded-none md:rounded-xl p-6 w-full md:max-w-md shadow-2xl h-full md:h-auto overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accentColor }} />
          <h2 className="text-white font-bold text-base">Add Task</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">Class</label>
            <select value={fields.class_id} onChange={e => set('class_id', e.target.value)} className={inputCls}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">Title</label>
            <input
              type="text"
              value={fields.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Midterm Exam"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">Type</label>
              <select value={fields.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">Due Date</label>
              <input type="date" value={fields.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">Estimated Hours</label>
            <input
              type="number"
              min="0.5" max="40" step="0.5"
              value={fields.estimated_hours}
              onChange={e => set('estimated_hours', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest block mb-1">
              Description <span className="text-gray-800 normal-case">(optional)</span>
            </label>
            <textarea
              value={fields.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Any extra context…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-800 text-gray-500 hover:text-white text-sm py-2 transition"
            >Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg text-black text-sm font-bold py-2 transition disabled:opacity-50"
              style={{ backgroundColor: loading ? '#4b5563' : accentColor }}
            >{loading ? 'Adding…' : 'Add Task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
