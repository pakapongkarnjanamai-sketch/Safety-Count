import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import DataTable from '../components/ui/DataTable'

const DEFAULT_EXTERNAL_PAGE_SIZE = 50

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== 'object') {
    return null
  }
  return {
    ...employee,
    sourceId: employee.sourceId ?? employee.id,
    requiresBadgeSwipe: employee.requiresBadgeSwipe ?? true,
  }
}

function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('')

  // External API panel
  const [showExternal, setShowExternal] = useState(false)
  const [externalList, setExternalList] = useState([])
  const [isLoadingExternal, setIsLoadingExternal] = useState(false)
  const [externalSearch, setExternalSearch] = useState('')
  const [externalDepartment, setExternalDepartment] = useState('')
  const [externalPage, setExternalPage] = useState(1)
  const [externalPageSize, setExternalPageSize] = useState(DEFAULT_EXTERNAL_PAGE_SIZE)
  const [externalTotalCount, setExternalTotalCount] = useState(-1)
  const [externalHasMore, setExternalHasMore] = useState(false)
  const [addingIds, setAddingIds] = useState(new Set())

  const showStatus = (message, type) => {
    setStatusMessage(message)
    setStatusType(type)
    setTimeout(() => setStatusMessage(''), 4000)
  }

  const loadEmployees = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/employees')
      if (!res.ok) throw new Error('Unable to load employees.')
      const json = await res.json()
      const data = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : [])
      setEmployees(data.map(normalizeEmployee).filter(Boolean))
    } catch (err) {
      showStatus(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  // Filter local employees
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmployees(employees)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredEmployees(
      employees.filter(
        (emp) =>
          String(emp.id).includes(q) ||
          String(emp.eId ?? '').toLowerCase().includes(q) ||
          (emp.name ?? '').toLowerCase().includes(q),
      ),
    )
  }, [searchQuery, employees])

  const filteredExternal = useMemo(() => {
    const q = externalSearch.trim().toLowerCase()
    if (!q) {
      return externalList
    }

    return externalList.filter(
      (emp) =>
        (emp.eId ?? '').toLowerCase().includes(q) ||
        (emp.name ?? '').toLowerCase().includes(q),
    )
  }, [externalSearch, externalList])

  const loadExternalEmployees = useCallback(async (page = 1, take = externalPageSize, department = externalDepartment) => {
    try {
      setIsLoadingExternal(true)
      const params = new URLSearchParams({
        skip: String((page - 1) * take),
        take: String(take),
      })

      if (department.trim()) {
        params.set('department', department.trim())
      }

      const res = await fetch(`/api/employees/external?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load external employees.')
      const payload = await res.json()
      const data = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : [])

      setExternalList(data)
      setExternalPage(page)
      setExternalPageSize(take)
      setExternalTotalCount(Array.isArray(payload) ? -1 : Number(payload?.totalCount ?? -1))
      setExternalHasMore(Array.isArray(payload) ? data.length === take : Boolean(payload?.hasMore))
      setShowExternal(true)
    } catch (err) {
      showStatus(err.message, 'error')
    } finally {
      setIsLoadingExternal(false)
    }
  }, [externalDepartment, externalPageSize])

  const onAddFromExternal = async (eId, name) => {
    const key = eId || name
    try {
      setAddingIds((prev) => new Set(prev).add(key))
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eId, name, requiresBadgeSwipe: true }),
      })
      if (!res.ok) throw new Error('Unable to add employee.')

      // Mark as added in external list
      setExternalList((prev) =>
        prev.map((emp) => ((emp.eId && emp.eId === eId) || emp.name === name ? { ...emp, alreadyAdded: true } : emp)),
      )
      showStatus(`"${name}" added successfully.`, 'success')
      await loadEmployees()
    } catch (err) {
      showStatus(err.message, 'error')
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const onToggleBadgeRequirement = async (row) => {
    const nextValue = !row.requiresBadgeSwipe
    try {
      const res = await fetch(`/api/employees/${row.sourceId ?? row.id}/badge-requirement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiresBadgeSwipe: nextValue }),
      })
      if (!res.ok) throw new Error('Unable to update attendance policy.')

      setEmployees((prev) =>
        prev.map((emp) =>
          (emp.sourceId ?? emp.id) === (row.sourceId ?? row.id)
            ? { ...emp, requiresBadgeSwipe: nextValue }
            : emp,
        ),
      )
      showStatus(`Updated attendance policy for "${row.name}".`, 'success')
    } catch (err) {
      showStatus(err.message, 'error')
    }
  }

  const onDeleteEmployee = async (id, name, eId) => {
    if (!window.confirm(`Delete "${name}" (ID: ${id})? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Unable to delete employee.')
      showStatus(`"${name}" deleted.`, 'success')
      await loadEmployees()
      // Update external list if visible
      if (showExternal) {
        setExternalList((prev) =>
          prev.map((emp) => ((emp.eId && emp.eId === eId) || emp.name === name ? { ...emp, alreadyAdded: false } : emp)),
        )
      }
    } catch (err) {
      showStatus(err.message, 'error')
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'ID',
      width: '80px',
      render: (row) => <span className="font-mono text-sm text-slate-600">{row.id}</span>,
    },
    {
      key: 'eId',
      label: 'EID',
      width: '120px',
      render: (row) => <span className="font-mono text-sm text-slate-600">{row.eId ?? '—'}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      key: 'requiresBadgeSwipe',
      label: 'Attendance Policy',
      width: '210px',
      render: (row) => {
        const required = row.requiresBadgeSwipe
        return (
          <button
            type="button"
            onClick={() => onToggleBadgeRequirement(row)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              required
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${required ? 'bg-amber-600' : 'bg-emerald-600'}`}
            />
            {required ? 'Staff' : 'Manager'}
          </button>
        )
      },
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (row) => (
        <button
          type="button"
          onClick={() => onDeleteEmployee(row.sourceId ?? row.id, row.name, row.eId)}
          disabled={!row.sourceId}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 hover:text-red-700 active:scale-95"
        >
          {row.sourceId ? 'Delete' : 'N/A'}
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{employees.length}</span> employee(s) in database
        </div>

        <button
          type="button"
          onClick={() => {
            if (showExternal) {
              setShowExternal(false)
            } else {
              setExternalSearch('')
              loadExternalEmployees(1)
            }
          }}
          disabled={isLoadingExternal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingExternal ? (
            <>
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </>
          ) : showExternal ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
              Close Import
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Import from API
            </>
          )}
        </button>
      </div>

      {/* Status message */}
      {statusMessage && (
        <div
          className={`animate-scale-in rounded-lg px-4 py-3 text-sm font-medium ${
            statusType === 'success'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* External API Import Popup */}
      {showExternal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 p-4">
          <div className="animate-scale-in flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-indigo-200/70">
            <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-indigo-950">
                  Import from External API
                  <span className="ml-2 text-sm font-normal text-indigo-700">
                    ({filteredExternal.length}/{externalTotalCount >= 0 ? externalTotalCount : '...'} shown)
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExternal(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px_120px_90px]">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                  </svg>
                  <input
                    value={externalSearch}
                    onChange={(e) => setExternalSearch(e.target.value)}
                    type="text"
                    placeholder="Search by EID or Name..."
                    className="w-full rounded-lg border border-indigo-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-indigo-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <input
                  value={externalDepartment}
                  onChange={(e) => setExternalDepartment(e.target.value)}
                  type="text"
                  placeholder="Department"
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                <select
                  value={externalPageSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value)
                    loadExternalEmployees(1, nextSize)
                  }}
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadExternalEmployees(1)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {filteredExternal.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-400">
                  No external employees found.
                </div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-100 bg-slate-50/95 backdrop-blur-sm">
                      <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">EID</th>
                      <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                      <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Department</th>
                      <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredExternal.map((emp) => (
                      <tr key={emp.eId ?? emp.name} className="transition-colors hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600">{emp.eId ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-700">{emp.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{emp.department || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          {emp.alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                              </svg>
                              Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAddFromExternal(emp.eId, emp.name)}
                              disabled={addingIds.has(emp.eId || emp.name)}
                              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-all duration-150 hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                            >
                              {addingIds.has(emp.eId || emp.name) ? '...' : 'Add'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-sm text-slate-600">
              <span>
                Page {externalPage}
                {externalTotalCount > 0 ? ` of ${Math.ceil(externalTotalCount / externalPageSize)}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadExternalEmployees(externalPage - 1)}
                  disabled={isLoadingExternal || externalPage <= 1}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => loadExternalEmployees(externalPage + 1)}
                  disabled={isLoadingExternal || !externalHasMore}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Search local employees */}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="text"
          placeholder="Search local employees..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm transition-colors duration-150 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl bg-white py-16 shadow-sm ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading employees...
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredEmployees}
          emptyMessage="No employees found. Click 'Import from API' to get started."
        />
      )}
    </div>
  )
}

export default EmployeesPage
