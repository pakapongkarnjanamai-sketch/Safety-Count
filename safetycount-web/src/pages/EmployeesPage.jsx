import { useCallback, useEffect, useState } from 'react'
import DataTable from '../components/ui/DataTable'

function buildEmployeeName(employee) {
  const thaiName = `${employee.ThaiPrefix ?? ''}${employee.ThaiFirstName ?? ''} ${employee.ThaiLastName ?? ''}`.trim()
  if (thaiName) {
    return thaiName
  }

  const englishName = `${employee.EnglishPrefix ?? ''}${employee.EnglishFirstName ?? ''} ${employee.EnglishLastName ?? ''}`.trim()
  if (englishName) {
    return englishName
  }

  return employee.name ?? 'Unknown'
}

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== 'object') {
    return null
  }

  if ('name' in employee && 'id' in employee) {
    return employee
  }

  return {
    id: employee.EId ?? employee.Id ?? '',
    sourceId: employee.Id ?? null,
    name: buildEmployeeName(employee),
    department: employee.Department ?? '',
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
  const [filteredExternal, setFilteredExternal] = useState([])
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
          (emp.name ?? '').toLowerCase().includes(q),
      ),
    )
  }, [searchQuery, employees])

  // Filter external employees
  useEffect(() => {
    if (!externalSearch.trim()) {
      setFilteredExternal(externalList)
      return
    }
    const q = externalSearch.toLowerCase()
    setFilteredExternal(
      externalList.filter(
        (emp) =>
          (emp.eId ?? '').toLowerCase().includes(q) ||
          emp.name.toLowerCase().includes(q),
      ),
    )
  }, [externalSearch, externalList])

  const loadExternalEmployees = async () => {
    try {
      setIsLoadingExternal(true)
      const res = await fetch('/api/employees/external')
      if (!res.ok) throw new Error('Unable to load external employees.')
      const data = await res.json()
      setExternalList(data)
      setShowExternal(true)
    } catch (err) {
      showStatus(err.message, 'error')
    } finally {
      setIsLoadingExternal(false)
    }
  }

  const onAddFromExternal = async (name) => {
    const key = name
    try {
      setAddingIds((prev) => new Set(prev).add(key))
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Unable to add employee.')

      // Mark as added in external list
      setExternalList((prev) =>
        prev.map((emp) => (emp.name === name ? { ...emp, alreadyAdded: true } : emp)),
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

  const onDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Delete "${name}" (ID: ${id})? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Unable to delete employee.')
      showStatus(`"${name}" deleted.`, 'success')
      await loadEmployees()
      // Update external list if visible
      if (showExternal) {
        setExternalList((prev) =>
          prev.map((emp) => (emp.name === name ? { ...emp, alreadyAdded: false } : emp)),
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
      key: 'name',
      label: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (row) => (
        <button
          type="button"
          onClick={() => onDeleteEmployee(row.sourceId ?? row.id, row.name)}
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
              loadExternalEmployees()
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

      {/* External API Import Panel */}
      {showExternal && (
        <div className="animate-scale-in overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-indigo-200/60">
          <div className="border-b border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-indigo-900">
                Import from External API
                <span className="ml-2 text-xs font-normal text-indigo-600">
                  ({externalList.filter((e) => !e.alreadyAdded).length} available)
                </span>
              </h3>
            </div>
            <div className="relative mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                value={externalSearch}
                onChange={(e) => setExternalSearch(e.target.value)}
                type="text"
                placeholder="Search external employees..."
                className="w-full rounded-lg border border-indigo-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-indigo-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredExternal.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No external employees found.
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">EID</th>
                    <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExternal.map((emp) => (
                    <tr key={emp.eId ?? emp.name} className="transition-colors hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-600">{emp.eId ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700">{emp.name}</td>
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
                            onClick={() => onAddFromExternal(emp.name)}
                            disabled={addingIds.has(emp.name)}
                            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-all duration-150 hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                          >
                            {addingIds.has(emp.name) ? '...' : 'Add'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
