import { useEffect, useState, useCallback } from 'react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import Sidebar from './components/Sidebar'
import Calendar from './components/Calendar'
import TodayPanel from './components/TodayPanel'
import AddTaskModal from './components/AddTaskModal'
import { getClasses, getPlan, getLimits, toggleTask } from './api'

dayjs.extend(isoWeek)

function thisMonday() {
  return dayjs().startOf('isoWeek').format('YYYY-MM-DD')
}

export default function App() {
  const [classes, setClasses] = useState([])
  const [limits, setLimits] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(thisMonday)
  const [visibleClasses, setVisibleClasses] = useState(new Set())
  const [showAddTask, setShowAddTask] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [cls, lim, p] = await Promise.all([
        getClasses(),
        getLimits(),
        getPlan(),
      ])
      setClasses(cls)
      setLimits(lim)
      setPlan(p)
      setVisibleClasses(prev => {
        const allIds = new Set(cls.map(c => c.id))
        if (prev.size === 0) return allIds
        const next = new Set([...prev].filter(id => allIds.has(id)))
        for (const id of allIds) { if (!prev.has(id)) next.add(id) }
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [])

  function toggleClass(id) {
    setVisibleClasses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggle(id) {
    setPlan(prev => {
      if (!prev) return prev
      const tasks = prev.tasks.map(t => t.id === id ? { ...t, hidden: t.hidden ? 0 : 1 } : t)
      const hiddenIds = new Set(tasks.filter(t => t.hidden).map(t => t.id))
      const blocks = prev.blocks.map(b => ({ ...b, hidden: hiddenIds.has(b.task_id) ? 1 : 0 }))
      return { ...prev, tasks, blocks }
    })
    toggleTask(id)
  }

  useEffect(() => {
    refresh()
    // Clean up Stripe redirect params without reloading
    const params = new URLSearchParams(window.location.search)
    if (params.has('upgraded')) {
      window.history.replaceState({}, '', '/')
    }
  }, [refresh])

  function navigate(direction) {
    if (direction === 0) {
      setCurrentDate(view === 'week' ? thisMonday() : dayjs().startOf('month').format('YYYY-MM-DD'))
      return
    }
    setCurrentDate(prev => {
      const d = dayjs(prev)
      if (view === 'week') return d.add(direction * 7, 'day').format('YYYY-MM-DD')
      return d.add(direction, 'month').startOf('month').format('YYYY-MM-DD')
    })
  }

  function handleViewChange(v) {
    setView(v)
    if (v === 'month') {
      setCurrentDate(dayjs(currentDate).startOf('month').format('YYYY-MM-DD'))
    } else {
      setCurrentDate(dayjs(currentDate).startOf('isoWeek').format('YYYY-MM-DD'))
    }
  }

  const filteredPlan = plan ? {
    ...plan,
    tasks: plan.tasks?.filter(t => visibleClasses.has(t.class_id)) ?? [],
    blocks: plan.blocks?.filter(b => visibleClasses.has(b.class_id)) ?? [],
  } : null

  return (
    <div className="flex min-h-screen flex-col md:flex-row">

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-900 bg-black sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-black font-bold text-[10px]">S</div>
          <span className="text-sm font-semibold text-white">Syllabuddy</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="text-gray-500 hover:text-white p-1 transition"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 md:z-auto
        transition-transform duration-200 md:transform-none md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          classes={classes}
          limits={limits}
          visibleClasses={visibleClasses}
          onToggleClass={toggleClass}
          onRefresh={refresh}
          onAddTask={() => { setShowAddTask(true); setMobileMenuOpen(false) }}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      </div>

      {showAddTask && (
        <AddTaskModal
          classes={classes}
          onClose={() => setShowAddTask(false)}
          onRefresh={refresh}
        />
      )}

      <main className="flex-1 flex flex-col p-4 md:p-6 gap-4 min-w-0 overflow-x-hidden">
        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Syllabuddy</h1>
            <p className="text-sm text-gray-600 mt-0.5">Your schedule and upcoming deadlines</p>
          </div>
        </div>

        {filteredPlan && <TodayPanel plan={filteredPlan} onToggle={handleToggle} />}

        {filteredPlan && <StatsBar plan={filteredPlan} currentDate={currentDate} view={view} />}

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border border-gray-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <Calendar
            view={view}
            onViewChange={handleViewChange}
            currentDate={currentDate}
            onNavigate={navigate}
            plan={filteredPlan}
            onRefresh={refresh}
            onToggle={handleToggle}
          />
        )}
      </main>
    </div>
  )
}

function StatsBar({ plan, currentDate, view }) {
  const today = dayjs().format('YYYY-MM-DD')
  const upcoming = plan.tasks?.filter(t => t.due_date >= today && !t.hidden) ?? []

  const windowStart = currentDate
  const windowEnd = view === 'week'
    ? dayjs(currentDate).add(6, 'day').format('YYYY-MM-DD')
    : dayjs(currentDate).endOf('month').format('YYYY-MM-DD')

  const windowTasks = plan.tasks?.filter(t => !t.hidden && t.due_date >= windowStart && t.due_date <= windowEnd) ?? []
  const windowStudy = plan.blocks
    ?.filter(b => b.date >= windowStart && b.date <= windowEnd)
    .reduce((s, b) => s + b.hours, 0) ?? 0

  const stats = view === 'semester'
    ? [{ label: 'Upcoming', value: upcoming.length }]
    : [
        { label: 'Upcoming', value: upcoming.length },
        { label: `Due this ${view}`, value: windowTasks.length },
        { label: `Study this ${view}`, value: `${windowStudy.toFixed(1)}h` },
      ]

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-black border border-gray-900 rounded-lg px-3 py-2 flex items-center gap-2.5">
          <p className="text-base font-bold text-white">{s.value}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
