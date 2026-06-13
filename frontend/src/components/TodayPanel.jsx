import dayjs from 'dayjs'

function urgencyColor(dueDate) {
  const days = dayjs(dueDate).diff(dayjs().startOf('day'), 'day')
  if (days <= 1) return '#ef4444'
  if (days <= 4) return '#f97316'
  if (days < 7)  return '#eab308'
  return '#22c55e'
}

const TYPE_COLORS = {
  exam:       '#ef4444',
  assignment: '#3b82f6',
  project:    '#a855f7',
  quiz:       '#f97316',
  reading:    '#22c55e',
  other:      '#6b7280',
}

const TYPE_ICONS = {
  exam: '📝',
  assignment: '📄',
  project: '🗂',
  quiz: '❓',
  reading: '📖',
  other: '📌',
}

export default function TodayPanel({ plan, onToggle }) {
  const today = dayjs().format('YYYY-MM-DD')
  const todayBlocks = plan?.blocks?.filter(b => b.date === today) ?? []
  const todayDue = plan?.tasks?.filter(t => t.due_date === today) ?? []
  const totalHours = todayBlocks.reduce((s, b) => s + b.hours, 0)
  const maxBlockHours = Math.max(...todayBlocks.map(b => b.hours), 0.1)

  const greeting = getGreeting()

  if (todayBlocks.length === 0 && todayDue.length === 0) {
    return (
      <div className="rounded-xl border border-gray-900 bg-black px-5 py-4">
        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
          {greeting} · {dayjs().format('dddd, MMM D')}
        </p>
        <p className="text-gray-500 text-sm">Nothing scheduled today — enjoy the break.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-900 bg-black px-5 py-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">
            {greeting} · {dayjs().format('dddd, MMM D')}
          </p>
          <h2 className="text-white font-bold text-base mt-0.5">Today</h2>
        </div>
        {totalHours > 0 && (
          <div className="text-right">
            <p className="text-xl font-bold text-white">{totalHours.toFixed(1)}h</p>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">scheduled</p>
          </div>
        )}
      </div>

      {/* Due today */}
      {todayDue.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-2">Due Today</p>
          <div className="space-y-2">
            {todayDue.map(t => {
              const done = Boolean(t.hidden)
              const color = done ? '#4b5563' : urgencyColor(t.due_date)
              return (
                <div key={t.id} className={`flex items-center gap-2 ${done ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => onToggle?.(t.id)}
                    className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer"
                    style={{ accentColor: color }}
                  />
                  <div className="w-0.5 h-4 rounded-full shrink-0" style={{ backgroundColor: done ? '#4b5563' : color }} />
                  <span className={`text-sm font-medium flex-1 truncate ${done ? 'line-through text-gray-600' : 'text-gray-200'}`}>{t.title}</span>
                  <span className="text-[10px] font-medium shrink-0" style={{ color: done ? '#4b5563' : color }}>
                    {t.class_name || ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Study blocks */}
      {todayBlocks.length > 0 && (
        <div className="space-y-3">
          {todayBlocks.map((block, i) => {
            const color = TYPE_COLORS[block.type] || block.color
            const pct = Math.round((block.hours / maxBlockHours) * 100)
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate leading-none">{block.task_title}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{block.class_name}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-400 shrink-0 ml-2">{block.hours}h</span>
                </div>
                <div className="h-px rounded-full bg-gray-900">
                  <div
                    className="h-px rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-900 flex items-center justify-between">
        <p className="text-[10px] text-gray-700">
          {todayBlocks.length} study {todayBlocks.length === 1 ? 'block' : 'blocks'}
          {todayDue.length > 0 ? ` · ${todayDue.length} due` : ''}
        </p>
        <div className="flex gap-1">
          {[...new Set(todayBlocks.map(b => TYPE_COLORS[b.type] || b.color))].map(color => (
            <span key={color} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = dayjs().hour()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
