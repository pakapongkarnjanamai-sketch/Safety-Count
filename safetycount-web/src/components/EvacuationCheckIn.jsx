import { useState } from 'react'

function EvacuationCheckIn() {
  const [employeeId, setEmployeeId] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSafeCheckIn = async () => {
    try {
      setIsSubmitting(true)
      setStatusMessage('')

      const response = await fetch('/api/evacuation/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(employeeId), status: 'Safe' }),
      })

      if (!response.ok) {
        throw new Error('Unable to submit emergency status.')
      }

      setStatusMessage('Your emergency status has been sent.')
    } catch (error) {
      setStatusMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-2xl font-semibold text-slate-800">Emergency Evacuation</h2>
      <p className="mb-4 text-sm text-slate-600">Enter your Employee ID then press the safety button.</p>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Employee ID</span>
        <input
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value.replace(/\D/g, ''))}
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="e.g. 4804120"
        />
      </label>

      <button
        type="button"
        disabled={isSubmitting || !employeeId}
        onClick={onSafeCheckIn}
        className="w-full rounded-xl bg-emerald-600 px-6 py-8 text-3xl font-bold tracking-wide text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
      >
        I AM SAFE
      </button>

      {statusMessage ? <p className="mt-4 text-sm text-slate-700">{statusMessage}</p> : null}
    </div>
  )
}

export default EvacuationCheckIn
