import { useEffect, useMemo, useState } from 'react'
import StatCard from '../components/ui/StatCard'
import { apiFetch } from '../lib/apiClient'

function formatDateParam(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DashboardPage() {
  const today = formatDateParam(new Date())
  const [viewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0 })
  const [history, setHistory] = useState([])
  const [todayAbsentees, setTodayAbsentees] = useState([])
  const [todayPresents, setTodayPresents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [workingDayMap, setWorkingDayMap] = useState({})

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        setIsLoading(true)

        let totalEmployees = 0
        try {
          const empRes = await apiFetch('/api/employees')
          if (empRes.ok) {
            const empData = await empRes.json()
            totalEmployees = Array.isArray(empData) ? empData.length : 0
          }
        } catch {
          // ignore
        }

        let presentToday = totalEmployees
        let absentToday = 0
        const absentList = []
        const presentList = []

        try {
          const attRes = await apiFetch(`/api/attendance/${today}`)
          if (attRes.ok) {
            const attData = await attRes.json()
            if (Array.isArray(attData) && attData.length > 0) {
              presentToday = attData.filter((r) => r.isPresent).length
              absentToday = attData.filter((r) => !r.isPresent).length
              attData.filter((r) => r.isPresent).forEach((r) => {
                presentList.push({ id: r.employeeId, name: r.employeeName })
              })
              attData.filter((r) => !r.isPresent).forEach((r) => {
                absentList.push({ id: r.employeeId, name: r.employeeName, remark: r.remark })
              })
            }
          }
        } catch {
          // ignore
        }

        if (isMounted) {
          setStats({ totalEmployees, presentToday, absentToday })
          setTodayAbsentees(absentList)
          setTodayPresents(presentList)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    const loadHistory = async () => {
      try {
        setIsHistoryLoading(true)
        const from = formatDateParam(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1))
        const to = formatDateParam(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0))

        const [historyRes, workingDayRes] = await Promise.all([
          apiFetch(`/api/attendance/history?from=${from}&to=${to}`),
          apiFetch(`/api/attendance/working-days?from=${from}&to=${to}`),
        ])

        if (historyRes.ok) {
          const data = await historyRes.json()
          if (isMounted) setHistory(Array.isArray(data) ? data : [])
        }

        if (workingDayRes.ok) {
          const data = await workingDayRes.json()
          const nextMap = Object.fromEntries(
            (Array.isArray(data) ? data : []).map((d) => [d.date, Boolean(d.isWorkingDay)]),
          )
          if (isMounted) setWorkingDayMap(nextMap)
        }
      } catch {
        if (isMounted) {
          setHistory([])
          setWorkingDayMap({})
        }
      } finally {
        if (isMounted) setIsHistoryLoading(false)
      }
    }

    loadStats()
    loadHistory()

    return () => {
      isMounted = false
    }
  }, [today, viewMonth])

  const attendanceRate = stats.totalEmployees > 0
    ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
    : 0

  const chartData = [...history].sort((a, b) => {
    const da = a.date?.split('T')[0] || a.date
    const db = b.date?.split('T')[0] || b.date
    return da.localeCompare(db)
  })

  const historyByDate = useMemo(() => {
    const map = new Map()
    chartData.forEach((d) => {
      const key = d.date?.split('T')[0] || d.date
      map.set(key, d)
    })
    return map
  }, [chartData])

  const calendarWeeks = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = formatDateParam(new Date(year, month, day))
      const row = historyByDate.get(dateKey)
      const rate = row && row.total > 0 ? Math.round((row.presentCount / row.total) * 100) : null
      const isWorkingDay = workingDayMap[dateKey] ?? (new Date(year, month, day).getDay() !== 0)

      cells.push({
        day,
        dateKey,
        row,
        rate,
        isWorkingDay,
        isFuture: dateKey > today,
        isToday: dateKey === today,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }
    return weeks
  }, [historyByDate, today, viewMonth, workingDayMap])

  return (
    <div className="space-y-4">
      <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={isLoading ? '—' : stats.totalEmployees}
          subtitle="In database"
          gradient="from-indigo-500 to-indigo-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
            </svg>
          }
        />
        <StatCard
          title="Present Today"
          value={isLoading ? '—' : stats.presentToday}
          subtitle="Checked in"
          gradient="from-emerald-500 to-teal-500"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          title="Absent Today"
          value={isLoading ? '—' : stats.absentToday}
          subtitle="Not present"
          gradient="from-red-500 to-rose-500"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          }
        />
        <StatCard
          title="Attendance Rate"
          value={isLoading ? '—' : `${attendanceRate}%`}
          subtitle="Today"
          gradient={attendanceRate >= 90 ? 'from-emerald-500 to-green-500' : attendanceRate >= 70 ? 'from-amber-500 to-yellow-500' : 'from-red-500 to-orange-500'}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h16.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 14.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75ZM1.75 9a.75.75 0 0 0 0 1.5h16.5a.75.75 0 0 0 0-1.5H1.75Z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3 lg:items-start">
        <div className="overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 lg:col-span-2 xl:p-5">
          <div className="mb-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900">Attendance Overview</h2>
              <span className="text-sm font-medium text-slate-500">
                {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
           
          </div>

          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-500">Loading calendar data...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 gap-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, dayIndex) => (
                    <div
                      key={d}
                      className={`rounded-md border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide ${dayIndex === 0 ? 'border-l-0' : ''} ${dayIndex === 6 ? 'border-r-0' : ''} ${dayIndex === 0 || dayIndex === 6 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500'}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-1 space-y-1">
                  {calendarWeeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                      {week.map((cell, cellIndex) => {
                        const isSundayCol = cellIndex === 0
                        const isSaturdayCol = cellIndex === 6

                        if (!cell) {
                          return (
                            <div
                              key={`empty-${weekIndex}-${cellIndex}`}
                              className={`h-24 rounded-md border border-slate-200 bg-slate-50/50 ${isSundayCol ? 'border-l-0' : ''} ${isSaturdayCol ? 'border-r-0' : ''}`}
                            />
                          )
                        }

                        const hasData = Boolean(cell.row && cell.row.total > 0)
                        const showMetrics = !cell.isFuture && cell.isWorkingDay && hasData
                        const showDayType = !cell.isFuture
                        const showNoData = !cell.isFuture && cell.isWorkingDay && !hasData
                        const dayTypeClass = cell.isWorkingDay
                          ? 'text-emerald-700 bg-emerald-50 ring-emerald-200'
                          : 'text-slate-700 bg-slate-100 ring-slate-300'
                        const backgroundClass = !cell.isWorkingDay
                          ? 'bg-slate-100 border-slate-300'
                          : cell.isFuture
                            ? 'bg-slate-50 border-slate-200'
                            : !hasData
                            ? 'bg-slate-100 border-slate-200'
                            : cell.rate >= 90
                              ? 'bg-emerald-50 border-emerald-200'
                              : cell.rate >= 70
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-rose-50 border-rose-200'
                        const hoverClass = cell.isFuture
                          ? 'hover:shadow-none'
                          : !cell.isWorkingDay
                            ? 'hover:bg-slate-200/70 hover:border-slate-400'
                            : hasData
                              ? 'hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md'
                              : 'hover:bg-slate-50 hover:border-slate-300'

                        return (
                          <div
                            key={cell.dateKey}
                            className={`flex h-24 flex-col rounded-md border p-1.5 transition-all duration-150 ${hoverClass} ${isSundayCol ? 'border-l-0' : ''} ${isSaturdayCol ? 'border-r-0' : ''} ${cell.isToday ? 'bg-indigo-50 border-indigo-300' : backgroundClass}`}
                            title={
                              cell.isFuture
                                ? `${cell.dateKey} | Future`
                                : !cell.isWorkingDay
                                ? `${cell.dateKey} | Holiday`
                                : hasData
                                  ? `${cell.dateKey} | Working Day | Present ${cell.row.presentCount} / ${cell.row.total} (${cell.rate}%)`
                                  : `${cell.dateKey} | Working Day | No data`
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${cell.isToday ? 'text-indigo-700' : 'text-slate-700'}`}>{cell.day}</span>
                              <div className="flex items-center gap-1">
                                {cell.isToday && <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Today</span>}
                                {showDayType && (
                                <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${dayTypeClass}`}>
                                  {cell.isWorkingDay ? 'Work' : 'Holiday'}
                                </span>
                                )}
                              </div>
                            </div>

                            {showMetrics ? (
                              <div className="mt-auto flex items-end justify-between">
                                <p className="text-[10px] font-semibold text-slate-700">
                                  {cell.rate}%
                                </p>
                                <div className="inline-flex items-center gap-1 text-slate-700">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-6 14a6 6 0 0 1 12 0v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V16Z" />
                                  </svg>
                                  <span className="text-[10px] font-semibold">{cell.row.presentCount}</span>
                                </div>
                              </div>
                            ) : showNoData ? (
                              <p className="mt-auto text-[10px] text-slate-400">No data</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 xl:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Today Summary</h3>
            <p className="text-xs text-slate-500">{today}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <div className="text-lg font-bold text-red-700">{todayAbsentees.length}</div>
              <div className="text-[10px] text-red-600">Absent</div>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <div className="text-lg font-bold text-emerald-700">{todayPresents.length}</div>
              <div className="text-[10px] text-emerald-600">Present</div>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700">Absent Today</h4>
                {todayAbsentees.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">
                    {todayAbsentees.length}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="py-4 text-center text-sm text-slate-500">Loading...</div>
              ) : todayAbsentees.length === 0 ? (
                <p className="py-3 text-sm text-emerald-700">Everyone is present.</p>
              ) : (
                <ul className="max-h-32 space-y-1.5 overflow-y-auto">
                  {todayAbsentees.map((emp) => (
                    <li key={emp.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-1.5 transition-colors hover:bg-red-50/60">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-6 14a6 6 0 1 1 12 0v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V16Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{emp.name || emp.id}</p>
                        {emp.remark && <p className="truncate text-xs text-slate-400">{emp.remark}</p>}
                      </div>
                      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">{emp.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Present Today</h4>
                {todayPresents.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">
                    {todayPresents.length}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="py-4 text-center text-sm text-slate-500">Loading...</div>
              ) : todayPresents.length === 0 ? (
                <p className="py-3 text-sm text-slate-600">No present records found.</p>
              ) : (
                <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {todayPresents.map((emp) => (
                    <li key={emp.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-1.5 transition-colors hover:bg-emerald-50/60">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-6 14a6 6 0 1 1 12 0v.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V16Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{emp.name || emp.id}</p>
                      </div>
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{emp.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
