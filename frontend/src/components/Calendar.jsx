import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { deleteTask } from '../api'
import SemesterView from './SemesterView'

dayjs.extend(isoWeek)

const TYPE_COLORS = {
  exam:       '#ef4444',
  assignment: '#3b82f6',
  project:    '#a855f7',
  quiz:       '#f97316',
  reading:    '#22c55e',
  other:      '#6b7280',
}

const TYPE_LABELS = {
  exam:       'Exam',
  assignment: 'Assignment',
  project:    'Project',
  quiz:       'Quiz',
  reading:    'Reading',
  other:      'Task',
}

const TYPE_ICONS = {
  exam:       '📝',
  assignment: '📄',
  project:    '🗂',
  quiz:       '❓',
  reading:    '📖',
  other:      '📌',
}

function escapeICS(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function generateICS(tasks) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Syllabuddy//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const t of tasks) {
    const start = t.due_date.replace(/-/g, '')
    const end   = dayjs(t.due_date).add(1, 'day').format('YYYYMMDD')
    lines.push(
      'BEGIN:VEVENT',
      `UID:syllabuddy-task-${t.id}@syllabuddy`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeICS(t.title)}`,
      `DESCRIPTION:${escapeICS(`${TYPE_LABELS[t.type] || 'Task'} · ${t.estimated_hours}h · ${t.class_name || ''}`)}`,
      `CATEGORIES:${escapeICS(TYPE_LABELS[t.type] || 'Task')}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function downloadICS(plan) {
  const tasks = plan?.tasks?.filter(t => !t.hidden) ?? []
  if (!tasks.length) return
  const ics = generateICS(tasks)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'syllabuddy.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Calendar({ view, onViewChange, currentDate, onNavigate, plan, onRefresh, onToggle }) {
  const today = dayjs().format('YYYY-MM-DD')

  const tasksByDay = {}
  const blocksByDay = {}

  if (plan) {
    plan.tasks?.forEach(t => { tasksByDay[t.due_date] = [...(tasksByDay[t.due_date] || []), t] })
    plan.blocks?.forEach(b => { blocksByDay[b.date] = [...(blocksByDay[b.date] || []), b] })
  }

  async function handleDeleteTask(id) {
    await deleteTask(id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-4 flex-1">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view !== 'semester' ? (
            <>
              <button
                onClick={() => onNavigate(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-900 transition text-sm"
              >←</button>
              <span className="text-sm font-semibold text-white min-w-[170px] text-center">
                {view === 'week'
                  ? `${dayjs(currentDate).format('MMM D')} – ${dayjs(currentDate).add(6, 'day').format('MMM D, YYYY')}`
                  : dayjs(currentDate).format('MMMM YYYY')}
              </span>
              <button
                onClick={() => onNavigate(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-900 transition text-sm"
              >→</button>
              <button
                onClick={() => onNavigate(0)}
                className="ml-1 text-xs text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-3 py-1.5 transition"
              >Today</button>
            </>
          ) : (
            <span className="text-sm font-semibold text-white">Semester Overview</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadICS(plan)}
            title="Export to Google Calendar / ICS"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-3 py-1.5 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </button>

          <div className="flex rounded-lg border border-gray-800 overflow-hidden">
            {['week', 'month', 'semester'].map(v => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`px-3 py-1.5 text-xs font-medium transition capitalize
                  ${view === v
                    ? 'bg-white text-black'
                    : 'text-gray-500 hover:text-white hover:bg-gray-900'}`}
              >{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Views */}
      {view === 'week' && (
        <WeekView
          monday={currentDate}
          today={today}
          tasksByDay={tasksByDay}
          blocksByDay={blocksByDay}
          onDelete={handleDeleteTask}
          onToggle={onToggle}
        />
      )}
      {view === 'month' && (
        <MonthView
          monthStart={dayjs(currentDate).startOf('month').format('YYYY-MM-DD')}
          today={today}
          tasksByDay={tasksByDay}
          blocksByDay={blocksByDay}
          onDelete={handleDeleteTask}
          onToggle={onToggle}
        />
      )}
      {view === 'semester' && <SemesterView plan={plan} />}
    </div>
  )
}

// ── Week View ────────────────────────────────────────────────────────────────

function WeekView({ monday, today, tasksByDay, blocksByDay, onDelete, onToggle }) {
  const days = Array.from({ length: 7 }, (_, i) => dayjs(monday).add(i, 'day'))

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
    <div className="grid grid-cols-7 gap-1.5 flex-1 min-w-[560px]">
      {days.map(day => {
        const key = day.format('YYYY-MM-DD')
        const isToday = key === today
        const isWeekend = day.day() === 0 || day.day() === 6
        const tasks = tasksByDay[key] || []
        const blocks = blocksByDay[key] || []
        const totalHours = blocks.reduce((s, b) => s + b.hours, 0)

        return (
          <div
            key={key}
            className={`flex flex-col rounded-xl min-h-[500px] border transition
              ${isToday ? 'border-white/15 bg-gray-950' : 'border-gray-900 bg-black'}`}
          >
            {/* Day header */}
            <div className={`px-3 pt-3 pb-2.5 border-b ${isToday ? 'border-white/10' : 'border-gray-900'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isWeekend ? 'text-gray-700' : 'text-gray-500'}`}>
                {day.format('ddd')}
              </p>
              <div className={`mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                ${isToday ? 'bg-white text-black' : isWeekend ? 'text-gray-600' : 'text-white'}`}>
                {day.format('D')}
              </div>
            </div>

            {/* Due tasks */}
            <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
              {tasks.map(t => (
                <DueCard key={t.id} task={t} onDelete={onDelete} onToggle={onToggle} />
              ))}
            </div>

            {/* Study blocks */}
            {blocks.length > 0 && (
              <div className={`px-2 pb-2 pt-2 border-t ${isToday ? 'border-white/5' : 'border-gray-900'}`}>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5 px-1">
                  {fmtMins(totalHours)} study
                </p>
                <div className="space-y-1">
                  {blocks.map((b, i) => <StudyBlock key={i} block={b} onToggle={onToggle} />)}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
    </div>
  )
}

// ── Month View ───────────────────────────────────────────────────────────────

function MonthView({ monthStart, today, tasksByDay, blocksByDay, onDelete, onToggle }) {
  const first = dayjs(monthStart)
  const month = first.month()
  const gridStart = first.startOf('isoWeek')
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col gap-1 flex-1">
      <div className="grid grid-cols-7 gap-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {cells.map((day, i) => {
          const key = day.format('YYYY-MM-DD')
          const inMonth = day.month() === month
          const isToday = key === today
          const tasks = tasksByDay[key] || []
          const blocks = blocksByDay[key] || []
          const totalStudy = blocks.reduce((s, b) => s + b.hours, 0)

          return (
            <div
              key={i}
              className={`rounded-lg border min-h-[100px] flex flex-col p-1.5 transition
                ${isToday
                  ? 'border-white/15 bg-gray-950'
                  : inMonth
                    ? 'border-gray-900 bg-black'
                    : 'border-gray-900/50 bg-black/40'}`}
            >
              {/* Day number */}
              <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold mb-1
                ${isToday ? 'bg-white text-black' : inMonth ? 'text-gray-400' : 'text-gray-800'}`}>
                {day.format('D')}
              </div>

              {/* Tasks */}
              <div className="space-y-0.5 flex-1">
                {tasks.slice(0, 3).map(t => {
                  const done = Boolean(t.hidden)
                  const color = done ? '#4b5563' : urgencyColor(t.due_date)
                  return (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-900 transition ${done ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => onToggle?.(t.id)}
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 w-2.5 h-2.5 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      <span className={`text-[10px] truncate flex-1 ${done ? 'line-through text-gray-600' : 'text-gray-400'}`}>{t.title}</span>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(t.id) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition text-[10px] shrink-0"
                      >✕</button>
                    </div>
                  )
                })}
                {tasks.length > 3 && (
                  <p className="text-[10px] text-gray-700 pl-1">+{tasks.length - 3} more</p>
                )}
              </div>

              {/* Study indicator */}
              {totalStudy > 0 && (
                <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-700 shrink-0" />
                  <span className="text-[9px] text-gray-500">{fmtMins(totalStudy)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────

function urgencyColor(dueDate) {
  const days = dayjs(dueDate).diff(dayjs().startOf('day'), 'day')
  if (days <= 1) return '#ef4444'  // red: today or tomorrow
  if (days <= 4) return '#f97316'  // orange: 2–4 days
  if (days < 7)  return '#eab308'  // yellow: 5–6 days
  return '#22c55e'                  // green: 7+ days
}

function DueCard({ task, onDelete, onToggle }) {
  const done = Boolean(task.hidden)
  const color = done ? '#4b5563' : urgencyColor(task.due_date)

  return (
    <div className={`group rounded-lg border transition p-2 ${done ? 'border-gray-900 opacity-50' : 'bg-gray-950 border-gray-900 hover:border-gray-700'}`}>
      <div className="flex items-start gap-1.5">
        <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle?.(task.id)}
          onClick={e => e.stopPropagation()}
          className="shrink-0 w-3 h-3 rounded cursor-pointer mt-0.5"
          style={{ accentColor: color }}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium leading-snug truncate ${done ? 'line-through text-gray-600' : 'text-gray-200'}`}>
            {task.title}
          </p>
          <p className="text-[9px] mt-0.5 font-medium" style={{ color }}>
            {TYPE_LABELS[task.type] || 'Task'} · {task.estimated_hours}h
          </p>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition text-[10px] shrink-0 mt-0.5"
        >✕</button>
      </div>
    </div>
  )
}

function fmtMins(hours) {
  const mins = Math.round(hours * 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function StudyBlock({ block, onToggle }) {
  const done = Boolean(block.hidden)
  const color = TYPE_COLORS[block.type] || block.color

  return (
    <div className={`flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-900 transition ${done ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle?.(block.task_id)}
        onClick={e => e.stopPropagation()}
        className="shrink-0 w-3 h-3 rounded cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className={`text-[10px] truncate ${done ? 'line-through text-gray-600' : 'text-gray-300'}`}>
        {fmtMins(block.hours)} · {block.task_title}
      </span>
    </div>
  )
}
