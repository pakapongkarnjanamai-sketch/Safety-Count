import { useEffect, useMemo, useState } from 'react'
import DataTable from '../components/ui/DataTable'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDateParam(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatInt(value) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

function MonthlyPivotPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [historyRows, setHistoryRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadYearlyHistory = async () => {
      try {
        setIsLoading(true)
        setErrorMessage('')

        const from = toDateParam(new Date(selectedYear, 0, 1))
        const to = toDateParam(new Date(selectedYear, 11, 31))

        const res = await fetch(`/api/attendance/history?from=${from}&to=${to}`)
        if (!res.ok) throw new Error('Unable to load monthly pivot data.')

        const data = await res.json()
        setHistoryRows(Array.isArray(data) ? data : [])
      } catch (err) {
        setErrorMessage(err.message)
        setHistoryRows([])
      } finally {
        setIsLoading(false)
      }
    }

    loadYearlyHistory()
  }, [selectedYear])

  const monthly = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => ({
      total: 0,
      present: 0,
      absent: 0,
      days: 0,
    }))

    for (const row of historyRows) {
      const d = new Date(row.date)
      const month = Number.isNaN(d.getTime()) ? -1 : d.getMonth()
      if (month < 0 || month > 11) {
        continue
      }

      buckets[month].total += Number(row.total ?? 0)
      buckets[month].present += Number(row.presentCount ?? 0)
      buckets[month].absent += Number(row.absentCount ?? 0)
      buckets[month].days += 1
    }

    return buckets
  }, [historyRows])

  const pivotRows = useMemo(() => {
    const totalYear = monthly.reduce((sum, m) => sum + m.total, 0)
    const presentYear = monthly.reduce((sum, m) => sum + m.present, 0)
    const absentYear = monthly.reduce((sum, m) => sum + m.absent, 0)
    const daysYear = monthly.reduce((sum, m) => sum + m.days, 0)

    const buildNumericRow = (id, metric, selector, yearlyTotal) => {
      const row = { id, metric }
      monthly.forEach((m, idx) => {
        row[`m${idx + 1}`] = selector(m)
      })
      row.year = yearlyTotal
      return row
    }

    const attendanceRateRow = { id: 'attendanceRate', metric: 'Attendance Rate' }
    monthly.forEach((m, idx) => {
      const rate = m.total > 0 ? (m.present / m.total) * 100 : 0
      attendanceRateRow[`m${idx + 1}`] = rate
    })
    attendanceRateRow.year = totalYear > 0 ? (presentYear / totalYear) * 100 : 0

    return [
      buildNumericRow('present', 'Present', (m) => m.present, presentYear),
      buildNumericRow('absent', 'Absent', (m) => m.absent, absentYear),
      buildNumericRow('total', 'Total Records', (m) => m.total, totalYear),
      buildNumericRow('days', 'Days Recorded', (m) => m.days, daysYear),
      attendanceRateRow,
    ]
  }, [monthly])

  const columns = useMemo(() => {
    const isCurrentYear = selectedYear === currentYear

    const monthColumns = MONTH_LABELS.map((label, idx) => ({
      key: `m${idx + 1}`,
      label,
      width: '90px',
      headerClassName: isCurrentYear && idx === currentMonth ? 'bg-amber-100 text-amber-800' : '',
      cellClassName: isCurrentYear && idx === currentMonth ? 'bg-amber-50 font-semibold text-amber-800' : '',
      render: (row) => row.id === 'attendanceRate' ? formatPercent(row[`m${idx + 1}`]) : formatInt(row[`m${idx + 1}`]),
    }))

    return [
      {
        key: 'metric',
        label: 'Metric',
        width: '180px',
        render: (row) => <span className="font-semibold text-slate-800">{row.metric}</span>,
      },
      ...monthColumns,
      {
        key: 'year',
        label: 'Year Total',
        width: '110px',
        render: (row) => row.id === 'attendanceRate' ? formatPercent(row.year) : formatInt(row.year),
      },
    ]
  }, [currentMonth, currentYear, selectedYear])

  const daily = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const buckets = Array.from({ length: daysInMonth }, () => ({
      total: 0,
      present: 0,
      absent: 0,
    }))

    for (const row of historyRows) {
      const d = new Date(row.date)
      if (Number.isNaN(d.getTime())) {
        continue
      }

      if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) {
        continue
      }

      const dayIndex = d.getDate() - 1
      if (dayIndex < 0 || dayIndex >= daysInMonth) {
        continue
      }

      buckets[dayIndex].total += Number(row.total ?? 0)
      buckets[dayIndex].present += Number(row.presentCount ?? 0)
      buckets[dayIndex].absent += Number(row.absentCount ?? 0)
    }

    return buckets
  }, [historyRows, selectedMonth, selectedYear])

  const dailyPivotRows = useMemo(() => {
    const totalMonth = daily.reduce((sum, d) => sum + d.total, 0)
    const presentMonth = daily.reduce((sum, d) => sum + d.present, 0)
    const absentMonth = daily.reduce((sum, d) => sum + d.absent, 0)

    const buildNumericRow = (id, metric, selector, monthTotal) => {
      const row = { id, metric }
      daily.forEach((d, idx) => {
        row[`d${idx + 1}`] = selector(d)
      })
      row.monthTotal = monthTotal
      return row
    }

    const attendanceRateRow = { id: 'dailyRate', metric: 'Attendance Rate' }
    daily.forEach((d, idx) => {
      const rate = d.total > 0 ? (d.present / d.total) * 100 : 0
      attendanceRateRow[`d${idx + 1}`] = rate
    })
    attendanceRateRow.monthTotal = totalMonth > 0 ? (presentMonth / totalMonth) * 100 : 0

    return [
      buildNumericRow('dailyPresent', 'Present', (d) => d.present, presentMonth),
      buildNumericRow('dailyAbsent', 'Absent', (d) => d.absent, absentMonth),
      buildNumericRow('dailyTotal', 'Total Records', (d) => d.total, totalMonth),
      attendanceRateRow,
    ]
  }, [daily])

  const dailyColumns = useMemo(() => {
    const shouldHighlightToday = selectedYear === currentYear && selectedMonth === currentMonth

    const dayColumns = daily.map((_, idx) => ({
      key: `d${idx + 1}`,
      label: `${idx + 1}`,
      width: '70px',
      headerClassName: shouldHighlightToday && idx + 1 === currentDay ? 'bg-emerald-100 text-emerald-800' : '',
      cellClassName: shouldHighlightToday && idx + 1 === currentDay ? 'bg-emerald-50 font-semibold text-emerald-800' : '',
      render: (row) => row.id === 'dailyRate' ? formatPercent(row[`d${idx + 1}`]) : formatInt(row[`d${idx + 1}`]),
    }))

    return [
      {
        key: 'metric',
        label: 'Metric',
        width: '180px',
        render: (row) => <span className="font-semibold text-slate-800">{row.metric}</span>,
      },
      ...dayColumns,
      {
        key: 'monthTotal',
        label: 'Month Total',
        width: '110px',
        render: (row) => row.id === 'dailyRate' ? formatPercent(row.monthTotal) : formatInt(row.monthTotal),
      },
    ]
  }, [currentDay, currentMonth, currentYear, daily, selectedMonth, selectedYear])

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly Pivot Table</h2>
            <p className="text-sm text-slate-500">Attendance summary pivoted by month for the selected year.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Year</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) || currentYear)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {MONTH_LABELS.map((label, idx) => (
                <option key={label} value={idx}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/70">
          Loading monthly pivot data...
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Monthly Pivot</h3>
            <p className="text-xs text-slate-500">Highlighted in amber: current month.</p>
            <DataTable columns={columns} data={pivotRows} emptyMessage="No attendance history found for this year." />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Daily Pivot ({MONTH_LABELS[selectedMonth]} {selectedYear})
            </h3>
            <p className="text-xs text-slate-500">Highlighted in green: today (when selected month is current month).</p>
            <DataTable columns={dailyColumns} data={dailyPivotRows} emptyMessage="No attendance history found for this month." />
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyPivotPage