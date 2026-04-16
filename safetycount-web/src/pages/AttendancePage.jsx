import { useCallback, useEffect, useRef, useState } from 'react'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'

function formatDateParam(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AttendancePage() {
  const today = formatDateParam(new Date())

  const [rows, setRows] = useState([])
  const [filteredRows, setFilteredRows] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [errorMessage, setErrorMessage] = useState('')

  const savedTimer = useRef(null)
  const debounceTimers = useRef({})

  const loadAttendance = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')
      const res = await fetch(`/api/attendance/${today}`)
      if (!res.ok) throw new Error('Unable to load attendance.')
      const data = await res.json()
      setRows(data)
    } catch (err) {
      setErrorMessage(err.message)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance()
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
      clearTimeout(savedTimer.current)
    }
  }, [])

  // Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRows(rows)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredRows(
      rows.filter(
        (r) =>
          String(r.employeeId).includes(q) ||
          (r.employeeName ?? '').toLowerCase().includes(q),
      ),
    )
  }, [searchQuery, rows])

  const updateSingle = useCallback(async (employeeId, isPresent, remark) => {
    try {
      setSaveStatus('saving')
      const res = await fetch(`/api/attendance/${today}/${employeeId}`, {
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
  }, [today])

  const onTogglePresent = (employeeId) => {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employeeId === employeeId ? { ...r, isPresent: !r.isPresent } : r,
      )
      const row = updated.find((r) => r.employeeId === employeeId)
      if (row) updateSingle(employeeId, row.isPresent, row.remark)
      return updated
    })
  }

  const onRemarkChange = (employeeId, remark) => {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employeeId === employeeId ? { ...r, remark } : r,
      )
      // Debounce remark saves
      clearTimeout(debounceTimers.current[employeeId])
      debounceTimers.current[employeeId] = setTimeout(() => {
        const row = updated.find((r) => r.employeeId === employeeId)
        if (row) updateSingle(employeeId, row.isPresent, row.remark)
      }, 800)
      return updated
    })
  }

  const presentCount = rows.filter((r) => r.isPresent).length
  const absentCount = rows.length - presentCount

  const columns = [
    {
      key: 'employeeId',
      label: 'ID',
      width: '80px',
      render: (row) => <span className="font-mono text-sm text-slate-600">{row.employeeId}</span>,
    },
    {
      key: 'employeeName',
      label: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.employeeName}</span>,
    },
    {
      key: 'isPresent',
      label: 'Status',
      width: '140px',
      render: (row) => (
        <button
          type="button"
          onClick={() => onTogglePresent(row.employeeId)}
          className="transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <StatusBadge variant={row.isPresent ? 'present' : 'absent'} />
        </button>
      ),
    },
    {
      key: 'remark',
      label: 'Remark',
      render: (row) => (
        <input
          value={row.remark ?? ''}
          onChange={(e) => onRemarkChange(row.employeeId, e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 transition-colors duration-150 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Optional remark"
        />
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Date + Summary + Save status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200/60">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Z" clipRule="evenodd" />
            </svg>
            Today: {today}
          </div>
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl bg-white py-16 shadow-sm ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading attendance...
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRows}
          emptyMessage="No attendance records. Add employees first."
        />
      )}
    </div>
  )
}

export default AttendancePage
