import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

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

export default function SemesterView({ plan }) {
  const today = dayjs()
  const futureTasks = plan.tasks?.filter(t => t.due_date >= today.format('YYYY-MM-DD')) ?? []

  if (futureTasks.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-700 text-sm">
        No upcoming tasks — upload a syllabus to see your semester.
      </div>
    )
  }

  const lastDate = dayjs(futureTasks[futureTasks.length - 1].due_date)
  const startWeek = today.startOf('isoWeek')
  const endWeek = lastDate.startOf('isoWeek')

  const weeks = []
  let w = startWeek
  while (w.isBefore(endWeek) || w.isSame(endWeek, 'day')) {
    weeks.push(w)
    w = w.add(1, 'week')
  }

  const tasksByWeek = {}
  const blocksByWeek = {}

  plan.tasks?.forEach(t => {
    const wk = dayjs(t.due_date).startOf('isoWeek').format('YYYY-MM-DD')
    tasksByWeek[wk] = [...(tasksByWeek[wk] || []), t]
  })

  plan.blocks?.forEach(b => {
    const wk = dayjs(b.date).startOf('isoWeek').format('YYYY-MM-DD')
    blocksByWeek[wk] = [...(blocksByWeek[wk] || []), b]
  })

  const weekHours = weeks.map(w => {
    const blocks = blocksByWeek[w.format('YYYY-MM-DD')] || []
    return blocks.reduce((s, b) => s + b.hours, 0)
  })
  const maxHours = Math.max(...weekHours, 1)

  return (
    <div className="space-y-1.5 flex-1">
      {weeks.map((week, i) => {
        const key = week.format('YYYY-MM-DD')
        const tasks = tasksByWeek[key] || []
        const hours = weekHours[i]
        const isCurrentWeek = week.isSame(today.startOf('isoWeek'), 'day')
        const isCrunch = tasks.some(t => t.type === 'exam' || t.type === 'project') || hours >= 8
        const pct = Math.round((hours / maxHours) * 100)

        return (
          <div
            key={key}
            className={`rounded-xl border px-4 py-3 flex items-center gap-4 transition
              ${isCrunch
                ? 'border-red-500/20 bg-red-500/5'
                : isCurrentWeek
                  ? 'border-white/10 bg-white/5'
                  : 'border-gray-900 bg-black'
              }`}
          >
            {/* Week label */}
            <div className="w-24 shrink-0">
              <p className={`text-xs font-semibold ${isCurrentWeek ? 'text-white' : 'text-gray-500'}`}>
                {isCurrentWeek ? 'This week' : week.format('MMM D')}
              </p>
              <p className="text-[10px] text-gray-700 mt-0.5">
                {week.format('MMM D')} – {week.add(6, 'day').format('MMM D')}
              </p>
            </div>

            {/* Deadline chips */}
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {tasks.length === 0
                ? <span className="text-xs text-gray-800 italic">No deadlines</span>
                : tasks.map(t => {
                    const color = TYPE_COLORS[t.type] || t.color
                    return (
                      <span
                        key={t.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded truncate max-w-[200px]"
                        style={{ backgroundColor: color + '18', color }}
                        title={t.title}
                      >
                        {TYPE_ICONS[t.type] || '📌'} {t.title}
                      </span>
                    )
                  })
              }
            </div>

            {/* Study load bar */}
            <div className="w-36 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-600">{hours.toFixed(1)}h study</p>
                {isCrunch && (
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Crunch</span>
                )}
              </div>
              <div className="h-px rounded-full bg-gray-900">
                <div
                  className="h-px rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isCrunch ? '#ef4444' : '#ffffff40',
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
