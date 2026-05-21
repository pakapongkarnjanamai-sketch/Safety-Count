import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StatusBadge from '../components/ui/StatusBadge'

function formatDateParam(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDayName(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function getWeekDates(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return []
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(sunday)
    nd.setDate(sunday.getDate() + i)
    return formatDateParam(nd)
  })
}

function AttendancePage() {
  const today = formatDateParam(new Date())
  const [selectedDate, setSelectedDate] = useState(today)

  const [rows, setRows] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPivotLoading, setIsPivotLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [errorMessage, setErrorMessage] = useState('')

  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [pivotDates, setPivotDates] = useState([])
  const [pivotMap, setPivotMap] = useState({})
  const [workingDayMap, setWorkingDayMap] = useState({}) // { 'yyyy-MM-dd': boolean }

  const savedTimer = useRef(null)

  const loadAttendance = useCallback(async (date) => {
    try {
      setIsLoading(true)
      setErrorMessage('')
      const res = await fetch(`/api/attendance/${date}`)
      if (!res.ok) throw new Error('Unable to load attendance.')
      const data = await res.json()
      setRows(data)
    } catch (err) {
      setErrorMessage(err.message)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate) {
      loadAttendance(selectedDate)
    }
  }, [selectedDate, loadAttendance])

  useEffect(() => {
    return () => {
      clearTimeout(savedTimer.current)
    }
  }, [])

  const updateAttendanceByDate = useCallback(async (date, employeeId, isPresent, remark) => {
    try {
      setSaveStatus('saving')
      const res = await fetch(`/api/attendance/${date}/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, isPresent, remark }),
      })
      if (!res.ok) throw new Error('Save failed.')

      setSaveStatus('saved')
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [])

  const onTogglePivotStatus = (employeeId, date) => {
    const dateRows = pivotMap[date] ?? []
    const row = dateRows.find((r) => r.employeeId === employeeId)
    if (!row) return

    const nextStatus = !row.isPresent

    setPivotMap((prevMap) => ({
      ...prevMap,
      [date]: (prevMap[date] ?? []).map((r) =>
        r.employeeId === employeeId ? { ...r, isPresent: nextStatus } : r,
      ),
    }))

    if (date === selectedDate) {
      setRows((prev) => prev.map((r) =>
        r.employeeId === employeeId ? { ...r, isPresent: nextStatus } : r,
      ))
    }

    updateAttendanceByDate(date, employeeId, nextStatus, row.remark)
  }

  const onResetAttendance = async () => {
    try {
      setIsResetting(true)
      setShowResetConfirm(false)
      const res = await fetch(`/api/attendance/${selectedDate}/reset`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Reset failed.')
      const data = await res.json()
      setRows(data.records)
      setPivotMap((prev) => ({ ...prev, [selectedDate]: data.records }))
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setIsResetting(false)
    }
  }

  const onToggleWorkingDay = async (date) => {
    const next = !(workingDayMap[date] ?? true)
    // Optimistic update
    setWorkingDayMap((prev) => ({ ...prev, [date]: next }))
    try {
      const res = await fetch(`/api/attendance/working-days/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWorkingDay: next }),
      })
      if (!res.ok) throw new Error('Failed to save working day.')
      // If we just re-enabled a working day that had no records, reload pivot
      if (next && date <= today && (pivotMap[date] ?? []).length === 0) {
        const r2 = await fetch(`/api/attendance/${date}`)
        if (r2.ok) {
          const data = await r2.json()
          setPivotMap((prev) => ({ ...prev, [date]: Array.isArray(data) ? data : [] }))
        }
      }
    } catch {
      // Revert on failure
      setWorkingDayMap((prev) => ({ ...prev, [date]: !next }))
    }
  }

  const presentCount = rows.filter((r) => r.isPresent).length
  const absentCount = rows.length - presentCount

  useEffect(() => {
    const loadPivotData = async () => {
      const weekDates = getWeekDates(selectedDate)
      setPivotDates(weekDates)
      setIsPivotLoading(true)

      const from = weekDates[0]
      const to = weekDates[weekDates.length - 1]

      // Only fetch attendance for dates up to today
      const fetchableDates = weekDates.filter((d) => d <= today)

      try {
        const [attendanceResults, wdRes] = await Promise.all([
          Promise.all(
            fetchableDates.map(async (d) => {
              const res = await fetch(`/api/attendance/${d}`)
              if (!res.ok) return [d, []]
              const data = await res.json()
              return [d, Array.isArray(data) ? data : []]
            }),
          ),
          fetch(`/api/attendance/working-days?from=${from}&to=${to}`),
        ])

        setPivotMap(Object.fromEntries(attendanceResults))

        if (wdRes.ok) {
          const wdData = await wdRes.json()
          const wdMap = Object.fromEntries(wdData.map((w) => [w.date, w.isWorkingDay]))
          setWorkingDayMap(wdMap)
        }
      } catch {
        setPivotMap({})
      } finally {
        setIsPivotLoading(false)
      }
    }

    loadPivotData()
  }, [selectedDate, today])

  const pivotRows = useMemo(() => {
    const employeeMap = new Map()

    pivotDates.forEach((date) => {
      ;(pivotMap[date] ?? []).forEach((r) => {
        if (!employeeMap.has(r.employeeId)) {
          employeeMap.set(r.employeeId, {
            employeeId: r.employeeId,
            employeeName: r.employeeName ?? r.employeeId,
            requiresBadgeSwipe: r.requiresBadgeSwipe ?? true,
            byDate: {},
          })
        }

        employeeMap.get(r.employeeId).byDate[date] = {
          isPresent: r.isPresent,
          remark: r.remark,
        }
      })
    })

    const all = Array.from(employeeMap.values()).sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId)))
    const q = searchQuery.trim().toLowerCase()
    if (!q) return all

    return all.filter((r) =>
      String(r.employeeId).includes(q) || String(r.employeeName ?? '').toLowerCase().includes(q),
    )
  }, [pivotDates, pivotMap, searchQuery])

  return (
    <div className="space-y-5">
      {/* Date + Summary + Save status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="attendance-date" className="text-sm font-medium text-slate-600">Date:</label>
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-150 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting}
            className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-700 active:scale-95"
            title="Clear and regenerate all attendance records for this date"
          >
            {isResetting ? 'Resetting...' : 'Reset Records'}
          </button>

          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200/60">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Present:</span>
            <span className="font-semibold text-slate-900">{presentCount}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200/60">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span className="text-slate-600">Absent:</span>
            <span className="font-semibold text-slate-900">{absentCount}</span>
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 text-sm">
          {saveStatus === 'saving' && (
            <span className="animate-fade-in flex items-center gap-1.5 text-slate-500">
              <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="animate-fade-in flex items-center gap-1.5 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="animate-fade-in flex items-center gap-1.5 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              Save failed
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder="Search by ID or name..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm transition-colors duration-150 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="animate-scale-in rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {errorMessage}
        </div>
      )}

      {/* Pivot Table */}
      {isLoading || isPivotLoading ? (
        <div className="flex items-center justify-center rounded-xl bg-white py-16 shadow-sm ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading pivot table...
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="sticky left-0 z-10 bg-slate-50/90 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                  {pivotDates.map((d) => {
                    const isFuture = d > today
                    const isWorking = workingDayMap[d] ?? true
                    const isHoliday = !isWorking
                    let thClass = 'text-slate-500'
                    let dayClass = 'text-slate-400'
                    if (isFuture)        { thClass = 'bg-slate-50/40 text-slate-300'; dayClass = 'text-slate-300' }
                    else if (isHoliday) { thClass = 'bg-orange-50/60 text-orange-300'; dayClass = 'text-orange-300' }
                    else if (d === today) { thClass = 'bg-indigo-50 text-indigo-700'; dayClass = 'text-indigo-500' }
                    return (
                      <th key={d} className={`whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider ${thClass}`}>
                        <div className={`text-[10px] font-bold ${dayClass}`}>{formatDayName(d)}</div>
                        <div>{formatShortDate(d)}</div>
                        {d === today && isWorking && <div className="mt-0.5"><span className="rounded bg-indigo-600 px-1 py-0.5 text-[9px] font-bold text-white">Today</span></div>}
                        {!isFuture && (
                          <button
                            type="button"
                            onClick={() => onToggleWorkingDay(d)}
                            title={isWorking ? 'Mark as holiday' : 'Mark as working day'}
                            className={`mt-1 rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                              isWorking
                                ? 'bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-600'
                                : 'bg-orange-100 text-orange-600 hover:bg-slate-100 hover:text-slate-500'
                            }`}
                          >
                            {isWorking ? 'Work' : 'Holiday'}
                          </button>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pivotRows.length === 0 ? (
                  <tr>
                    <td colSpan={pivotDates.length + 1} className="px-4 py-12 text-center text-sm text-slate-400">
                      No attendance records. Add employees first.
                    </td>
                  </tr>
                ) : (
                  pivotRows.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2.5">
                        <div className="font-mono text-xs text-slate-500">{row.employeeId}</div>
                        <div className="font-medium text-slate-800">{row.employeeName}</div>
                        {!row.requiresBadgeSwipe && (
                          <div className="mt-0.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">Manager</span>
                          </div>
                        )}
                      </td>
                      {pivotDates.map((d) => {
                        const isFuture = d > today
                        const isWorking = workingDayMap[d] ?? true
                        const isHoliday = !isWorking
                        const cell = row.byDate[d]
                        const isPresent = cell?.isPresent
                        let tdClass = ''
                        if (isFuture)        tdClass = 'bg-slate-50/40'
                        else if (isHoliday) tdClass = 'bg-orange-50/40'
                        else if (d === today) tdClass = 'bg-indigo-50/60'
                        return (
                          <td key={`${row.employeeId}-${d}`} className={`px-3 py-2.5 ${tdClass}`}>
                            {isFuture || isHoliday ? (
                              <span className={`select-none text-xs ${isHoliday ? 'text-orange-300' : 'text-slate-300'}`}>—</span>
                            ) : cell ? (
                              <button
                                type="button"
                                onClick={() => onTogglePivotStatus(row.employeeId, d)}
                                className="transition-transform duration-150 hover:scale-105 active:scale-95"
                                title={`Toggle ${row.employeeId} on ${d}`}
                              >
                                <StatusBadge variant={isPresent ? 'present' : 'absent'} />
                              </button>
                            ) : !row.requiresBadgeSwipe ? (
                              <StatusBadge variant="present" />
                            ) : (
                              <StatusBadge variant="pending" label="N/A" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-xl ring-1 ring-slate-200 max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900">Reset Attendance Records</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will delete all attendance records for <span className="font-mono font-medium">{selectedDate}</span> and create fresh ones with all employees marked as present.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onResetAttendance}
                disabled={isResetting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-red-700 active:scale-95"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AttendancePage
