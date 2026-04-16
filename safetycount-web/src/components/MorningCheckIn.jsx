import { useEffect, useState } from 'react'

const EMPLOYEE_API_URL = '/api/employees?department=SA&skip=0&take=40'

function mapEmployeeToRow(employee) {
  const parsedEmployeeId = Number(employee.EId)
  const employeeId = Number.isNaN(parsedEmployeeId) ? Number(employee.Id) : parsedEmployeeId
  const name = `${employee.ThaiPrefix ?? ''}${employee.ThaiFirstName ?? ''} ${employee.ThaiLastName ?? ''}`.trim()

  return {
    employeeId,
    name,
    isPresent: true,
    remark: '',
  }
}

function MorningCheckIn() {
  const [rows, setRows] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadEmployees = async () => {
      try {
        setIsLoadingEmployees(true)
        setStatusMessage('')

        const response = await fetch(EMPLOYEE_API_URL)
        if (!response.ok) {
          throw new Error('Unable to load employees.')
        }

        const payload = await response.json()
        const employeeRows = Array.isArray(payload?.data)
          ? payload.data
              .map(mapEmployeeToRow)
              .filter((row) => Number.isInteger(row.employeeId) && row.employeeId > 0)
          : []

        if (isMounted) {
          setRows(employeeRows)
        }
      } catch (error) {
        if (isMounted) {
          setStatusMessage(error.message)
          setRows([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingEmployees(false)
        }
      }
    }

    loadEmployees()

    return () => {
      isMounted = false
    }
  }, [])

  const onTogglePresent = (employeeId, isPresent) => {
    setRows((prev) =>
      prev.map((row) =>
        row.employeeId === employeeId ? { ...row, isPresent } : row,
      ),
    )
  }

  const onRemarkChange = (employeeId, remark) => {
    setRows((prev) =>
      prev.map((row) => (row.employeeId === employeeId ? { ...row, remark } : row)),
    )
  }

  const onSubmit = async () => {
    try {
      setIsSubmitting(true)
      setStatusMessage('')

      const payload = rows.map(({ employeeId, isPresent, remark }) => ({
        employeeId,
        isPresent,
        remark,
      }))

      const response = await fetch('/api/attendance/morning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Unable to submit attendance.')
      }

      setStatusMessage('Morning attendance submitted successfully.')
    } catch (error) {
      setStatusMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-2xl font-semibold text-slate-800">Morning Attendance</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-700">Employee ID</th>
              <th className="px-3 py-2 font-medium text-slate-700">Name</th>
              <th className="px-3 py-2 font-medium text-slate-700">Present</th>
              <th className="px-3 py-2 font-medium text-slate-700">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.employeeId}>
                <td className="px-3 py-3">{row.employeeId}</td>
                <td className="px-3 py-3">{row.name}</td>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={row.isPresent}
                    onChange={(event) => onTogglePresent(row.employeeId, event.target.checked)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={row.remark}
                    onChange={(event) => onRemarkChange(row.employeeId, event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                    placeholder="Optional remark"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isLoadingEmployees || rows.length === 0}
          className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Attendance'}
        </button>
        {statusMessage ? <p className="text-sm text-slate-700">{statusMessage}</p> : null}
      </div>
    </div>
  )
}

export default MorningCheckIn
