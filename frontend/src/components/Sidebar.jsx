import { useState } from 'react'
import { uploadSyllabus, deleteClass, startCheckout } from '../api'

export default function Sidebar({ classes, limits, visibleClasses, onToggleClass, onRefresh, onAddTask, onMobileClose }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const [upgrading, setUpgrading] = useState(false)
  const atLimit = limits && classes.length >= limits.max_classes
  const premium = limits?.premium ?? false

  async function handleUpgrade() {
    setUpgrading(true)
    try { await startCheckout() } catch (e) { setError(e.message); setUpgrading(false) }
  }

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await uploadSyllabus(file)
      onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function handleDelete(id) {
    if (!confirm('Remove this class and all its tasks?')) return
    await deleteClass(id)
    onRefresh()
  }

  return (
    <aside className={`shrink-0 flex flex-col bg-black border-r border-gray-900 h-screen md:min-h-screen overflow-y-auto transition-all duration-200 overflow-x-hidden ${collapsed ? 'w-12' : 'w-64'}`}>
      <div className={`flex flex-col gap-6 ${collapsed ? 'p-3' : 'p-5'}`}>

        {/* Logo + collapse */}
        <div className={`flex items-center pt-1 ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-black font-bold text-xs shrink-0">S</div>
            {!collapsed && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white tracking-tight text-sm">Syllabuddy</span>
                {premium && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white text-black">
                    Pro
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Close button — mobile only */}
            {!collapsed && (
              <button
                onClick={onMobileClose}
                className="md:hidden text-gray-600 hover:text-white transition p-1 rounded hover:bg-gray-900"
              >✕</button>
            )}
            {/* Collapse button — desktop only */}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
              className="hidden md:block text-gray-700 hover:text-white transition text-xs p-1 rounded hover:bg-gray-900"
            >{collapsed ? '→' : '←'}</button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Classes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">Classes</p>
                <button
                  onClick={onAddTask}
                  disabled={classes.length === 0}
                  title={classes.length === 0 ? 'Add a class first' : 'Add task manually'}
                  className="text-[10px] text-gray-500 hover:text-white disabled:text-gray-800 disabled:cursor-not-allowed transition font-semibold"
                >+ Task</button>
              </div>

              {classes.length === 0 && (
                <p className="text-xs text-gray-700 italic">No classes yet.</p>
              )}

              <ul className="space-y-0.5">
                {classes.map(c => {
                  const visible = visibleClasses?.has(c.id) ?? true
                  return (
                    <li key={c.id} className="group rounded-lg px-2 py-1.5 hover:bg-gray-900 transition">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => onToggleClass(c.id)}
                          className="shrink-0 w-3 h-3 rounded cursor-pointer"
                          style={{ accentColor: c.color }}
                        />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className={`text-xs truncate flex-1 ${visible ? 'text-gray-300' : 'text-gray-700 line-through'}`}>
                          {c.name}
                        </span>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-gray-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-[10px] shrink-0"
                        >✕</button>
                      </div>
                      <p className="text-[10px] text-gray-700 mt-0.5 pl-5">
                        {c.task_count} {c.task_count === 1 ? 'task' : 'tasks'}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Upload */}
            <div>
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mb-3">Add Class</p>

              {atLimit && !premium ? (
                <div className="rounded-lg border border-dashed border-gray-800 p-4 text-center">
                  <p className="text-xs text-white font-semibold">Free plan: 1 class</p>
                  <p className="text-[10px] text-gray-600 mt-1 mb-3">Upgrade for unlimited classes, priority parsing, and more.</p>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="w-full rounded-lg bg-white text-black text-xs font-bold py-1.5 transition hover:bg-gray-200 disabled:opacity-50"
                  >{upgrading ? 'Redirecting…' : 'Upgrade to Pro →'}</button>
                </div>
              ) : (
                <label
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition
                    ${dragging ? 'border-white/30 bg-white/5' : 'border-gray-800 hover:border-gray-700'}`}
                >
                  <input type="file" accept=".pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-4 h-4 border border-gray-700 border-t-white rounded-full animate-spin" />
                      <p className="text-[10px] text-gray-500">Parsing syllabus…</p>
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-[10px] text-gray-600 text-center">Drop PDF or <span className="text-gray-400">browse</span></p>
                    </>
                  )}
                </label>
              )}

              {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
