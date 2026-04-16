import { useEffect, useState } from 'react'
import StatCard from '../components/ui/StatCard'

function formatDateParam(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function formatWeekday(dateStr) {
  const d = new Date(dateStr)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[d.getDay()]
}

function DashboardPage() {
  const today = formatDateParam(new Date())
  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0 })
  const [history, setHistory] = useState([])
  const [todayAbsentees, setTodayAbsentees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      try {
        setIsLoading(true)

        // Fetch employees
        let totalEmployees = 0
        try {
          const empRes = await fetch('/api/employees')
          if (empRes.ok) {
            const empData = await empRes.json()
            totalEmployees = Array.isArray(empData) ? empData.length : 0
          }
        } catch { /* ignore */ }

        // Fetch today's attendance
        let presentToday = totalEmployees
        let absentToday = 0
        const absentList = []
        try {
          const attRes = await fetch(`/api/attendance/${today}`)
          if (attRes.ok) {
            const attData = await attRes.json()
            if (Array.isArray(attData) && attData.length > 0) {
              presentToday = attData.filter((r) => r.isPresent).length
              absentToday = attData.filter((r) => !r.isPresent).length
              attData.filter((r) => !r.isPresent).forEach((r) => {
                absentList.push({ id: r.employeeId, name: r.employeeName, remark: r.remark })
              })
            }
          }
        } catch { /* ignore */ }

        if (isMounted) {
          setStats({ totalEmployees, presentToday, absentToday })
          setTodayAbsentees(absentList)
        }
      } catch { /* ignore */ } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    const loadHistory = async () => {
      try {
        setIsHistoryLoading(true)
        const to = formatDateParam(new Date())
        const from = formatDateParam(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
        const res = await fetch(`/api/attendance/history?from=${from}&to=${to}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) setHistory(data)
        }
      } catch { /* ignore */ } finally {
        if (isMounted) setIsHistoryLoading(false)
      }
    }

    loadStats()
    loadHistory()
    return () => { isMounted = false }
  }, [today])

  // Compute derived data
  const attendanceRate = stats.totalEmployees > 0
    ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
    : 0

  const chartData = [...history].sort((a, b) => {
    const da = a.date?.split('T')[0] || a.date
    const db = b.date?.split('T')[0] || b.date
    return da.localeCompare(db)
  })

  const maxTotal = Math.max(...chartData.map((d) => d.total), 1)

  // Weekly averages
  const weeklyAvg = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + (d.total > 0 ? (d.presentCount / d.total) * 100 : 0), 0) / chartData.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance Bar Chart — 2/3 width */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Attendance Overview</h2>
              <p className="mt-0.5 text-sm text-slate-500">Daily present vs absent — Last 14 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-500">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
                <span className="text-slate-500">Absent</span>
              </div>
            </div>
          </div>

          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading chart data...
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-400">
              No attendance data available
            </div>
          ) : (
            <div className="relative">
              {/* Y-axis scale labels */}
              <div className="absolute -left-1 top-0 bottom-8 flex flex-col justify-between text-right pr-2" style={{ width: '36px' }}>
                <span className="text-[10px] text-slate-400">{maxTotal}</span>
                <span className="text-[10px] text-slate-400">{Math.round(maxTotal / 2)}</span>
                <span className="text-[10px] text-slate-400">0</span>
              </div>

              {/* Chart area */}
              <div className="ml-9">
                {/* Grid lines */}
                <div className="relative" style={{ height: '200px' }}>
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="border-t border-dashed border-slate-100" />
                    <div className="border-t border-dashed border-slate-100" />
                    <div className="border-t border-slate-200/60" />
                  </div>

                  {/* Bars */}
                  <div className="relative flex h-full items-end gap-1.5" style={{ paddingBottom: '1px' }}>
                    {chartData.map((day) => {
                      const dateKey = day.date?.split('T')[0] || day.date
                      const presentH = (day.presentCount / maxTotal) * 100
                      const absentH = (day.absentCount / maxTotal) * 100
                      const isToday = dateKey === today
                      const rate = day.total > 0 ? Math.round((day.presentCount / day.total) * 100) : 0

                      return (
                        <div
                          key={dateKey}
                          className="group relative flex flex-1 flex-col items-center"
                          style={{ height: '100%' }}
                        >
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute -top-16 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap">
                            <div className="font-semibold">{formatShortDate(dateKey)} ({formatWeekday(dateKey)})</div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-emerald-400">✓ {day.presentCount}</span>
                              <span className="text-red-400">✗ {day.absentCount}</span>
                              <span className="text-slate-300">({rate}%)</span>
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-slate-800" />
                          </div>

                          {/* Stacked bar */}
                          <div className="flex w-full flex-col items-stretch justify-end" style={{ height: '100%' }}>
                            <div className="flex flex-col justify-end" style={{ height: '100%' }}>
                              {/* Absent (top) */}
                              {day.absentCount > 0 && (
                                <div
                                  className="w-full rounded-t-sm bg-red-400 transition-all duration-500 ease-out group-hover:bg-red-500"
                                  style={{ height: `${absentH}%`, minHeight: day.absentCount > 0 ? '2px' : 0 }}
                                />
                              )}
                              {/* Present (bottom) */}
                              <div
                                className={`w-full transition-all duration-500 ease-out ${day.absentCount === 0 ? 'rounded-t-sm' : ''} ${isToday ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-emerald-400 group-hover:bg-emerald-500'}`}
                                style={{ height: `${presentH}%`, minHeight: day.presentCount > 0 ? '2px' : 0 }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="mt-2 flex gap-1.5">
                  {chartData.map((day) => {
                    const dateKey = day.date?.split('T')[0] || day.date
                    const isToday = dateKey === today
                    return (
                      <div key={dateKey} className="flex-1 text-center">
                        <span className={`text-[10px] leading-none ${isToday ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                          {isToday ? 'Today' : formatShortDate(dateKey).split(' ')[0]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right side — summaries */}
        <div className="flex flex-col gap-6">
          {/* Attendance Rate Ring */}
          <div className="overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <h3 className="text-sm font-semibold text-slate-900">14-Day Average</h3>
            <p className="mt-0.5 text-xs text-slate-500">Overall attendance rate</p>

            <div className="mt-5 flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  {/* Background circle */}
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  {/* Progress circle */}
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke={weeklyAvg >= 90 ? '#10b981' : weeklyAvg >= 70 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(weeklyAvg / 100) * 314.16} 314.16`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{isHistoryLoading ? '—' : `${weeklyAvg}%`}</span>
                  <span className="text-[10px] text-slate-400">avg. present</span>
                </div>
              </div>
            </div>

            {/* Mini stats */}
            {!isHistoryLoading && chartData.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {chartData.filter((d) => d.total > 0 && (d.presentCount / d.total) * 100 === 100).length}
                  </div>
                  <div className="text-[10px] text-emerald-600">Perfect days</div>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                  <div className="text-lg font-bold text-red-700">
                    {chartData.reduce((sum, d) => sum + d.absentCount, 0)}
                  </div>
                  <div className="text-[10px] text-red-600">Total absences</div>
                </div>
              </div>
            )}
          </div>

          {/* Today's Absentees */}
          <div className="overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Absent Today</h3>
                <p className="mt-0.5 text-xs text-slate-500">{today}</p>
              </div>
              {todayAbsentees.length > 0 && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                  {todayAbsentees.length}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="mt-4 flex items-center justify-center py-6">
                <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : todayAbsentees.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="mt-2 text-sm font-medium text-emerald-700">Everyone is present!</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {todayAbsentees.map((emp) => (
                  <li key={emp.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-red-50/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                      {(emp.name || emp.id).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{emp.name || emp.id}</p>
                      {emp.remark && (
                        <p className="truncate text-xs text-slate-400">{emp.remark}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                      {emp.id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Daily Trend — sparkline-style cards */}
      {!isHistoryLoading && chartData.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Daily Attendance Trend</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {chartData.map((day) => {
                const dateKey = day.date?.split('T')[0] || day.date
                const isToday = dateKey === today
                const rate = day.total > 0 ? Math.round((day.presentCount / day.total) * 100) : 0
                const rateColor = rate === 100 ? 'text-emerald-600' : rate >= 90 ? 'text-emerald-500' : rate >= 70 ? 'text-amber-500' : 'text-red-500'
                const bgColor = rate === 100 ? 'bg-emerald-50' : rate >= 90 ? 'bg-emerald-50/60' : rate >= 70 ? 'bg-amber-50' : 'bg-red-50'

                return (
                  <div
                    key={dateKey}
                    className={`flex flex-col items-center rounded-lg px-3 py-3 transition-all duration-200 ${isToday ? 'bg-indigo-50 ring-2 ring-indigo-200' : `${bgColor} ring-1 ring-slate-100`}`}
                    style={{ minWidth: '72px' }}
                  >
                    <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {formatWeekday(dateKey)}
                    </span>
                    <span className={`text-xs font-medium ${isToday ? 'text-indigo-700' : 'text-slate-600'}`}>
                      {formatShortDate(dateKey)}
                    </span>
                    <span className={`mt-1.5 text-lg font-bold ${isToday ? 'text-indigo-700' : rateColor}`}>
                      {rate}%
                    </span>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="text-emerald-500">{day.presentCount}</span>
                      <span>/</span>
                      <span>{day.total}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
