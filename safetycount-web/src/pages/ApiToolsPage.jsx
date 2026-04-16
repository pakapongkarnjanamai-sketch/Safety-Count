import { useMemo, useState } from 'react'

function ApiToolsPage() {
  const [status, setStatus] = useState({ type: '', message: '' })

  const [shareFileName, setShareFileName] = useState('')
  const [isRunningShareCheck, setIsRunningShareCheck] = useState(false)
  const [shareResult, setShareResult] = useState(null)

  const [badgeFile, setBadgeFile] = useState(null)
  const [isRunningUploadCheck, setIsRunningUploadCheck] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSubject, setEmailSubject] = useState('Daily Attendance Report')
  const [includeAttendanceTable, setIncludeAttendanceTable] = useState(true)
  const [attendanceDate, setAttendanceDate] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const canSubmitEmail = useMemo(() => {
    const hasRecipient = emailTo.trim() || emailRecipients.trim()
    return Boolean(hasRecipient && emailSubject.trim())
  }, [emailTo, emailRecipients, emailSubject])

  const showStatus = (type, message) => {
    setStatus({ type, message })
    window.setTimeout(() => {
      setStatus((prev) => (prev.message === message ? { type: '', message: '' } : prev))
    }, 4000)
  }

  const parseMultiRecipients = (value) =>
    value
      .split(/[;,]/g)
      .map((x) => x.trim())
      .filter(Boolean)

  const onRunShareCrossCheck = async () => {
    try {
      setIsRunningShareCheck(true)
      setShareResult(null)
      const params = new URLSearchParams()
      if (shareFileName.trim()) {
        params.set('fileName', shareFileName.trim())
      }

      const query = params.toString()
      const endpoint = query
        ? `/api/attendance/internal/crosscheck-badges/share?${query}`
        : '/api/attendance/internal/crosscheck-badges/share'

      const res = await fetch(endpoint, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.message ?? 'Unable to run share cross-check.')
      }

      setShareResult(payload)
      showStatus('success', 'Share cross-check completed.')
    } catch (err) {
      showStatus('error', err.message)
    } finally {
      setIsRunningShareCheck(false)
    }
  }

  const onRunUploadCrossCheck = async () => {
    if (!badgeFile) {
      showStatus('error', 'Please select a .TAF file first.')
      return
    }

    try {
      setIsRunningUploadCheck(true)
      setUploadResult(null)

      const formData = new FormData()
      formData.append('file', badgeFile)

      const res = await fetch('/api/attendance/internal/crosscheck-badges', {
        method: 'POST',
        body: formData,
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload?.message ?? 'Unable to run upload cross-check.')
      }

      setUploadResult(payload)
      showStatus('success', 'Upload cross-check completed.')
    } catch (err) {
      showStatus('error', err.message)
    } finally {
      setIsRunningUploadCheck(false)
    }
  }

  const onSendEmail = async () => {
    if (!canSubmitEmail) {
      showStatus('error', 'Please provide recipient(s) and subject.')
      return
    }

    try {
      setIsSendingEmail(true)
      setEmailResult(null)

      const payload = {
        to: emailTo.trim() || null,
        recipients: parseMultiRecipients(emailRecipients),
        subject: emailSubject.trim(),
        body: includeAttendanceTable ? '' : emailBody,
        includeAttendanceTable,
        attendanceDate: attendanceDate || null,
        isBodyHtml: includeAttendanceTable,
      }

      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = result?.detail ? ` ${result.detail}` : ''
        throw new Error((result?.title ?? result?.message ?? 'Unable to send email.') + detail)
      }

      setEmailResult(result)
      showStatus('success', 'Email sent successfully.')
    } catch (err) {
      showStatus('error', err.message)
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">API Tools</h1>
        <p className="mt-1 text-sm text-slate-600">Manual actions for notifications and badge cross-check APIs.</p>
      </div>

      {status.message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ring-1 ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-red-200'
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <h2 className="text-base font-semibold text-slate-900">1) Cross-check Badge From Share Path</h2>
        <p className="mt-1 text-sm text-slate-600">Calls <span className="font-mono">POST /api/attendance/internal/crosscheck-badges/share</span>.</p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-72 flex-1">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">File Name (optional)</span>
            <input
              value={shareFileName}
              onChange={(e) => setShareFileName(e.target.value)}
              placeholder="16APR26.TAF"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <button
            type="button"
            onClick={onRunShareCrossCheck}
            disabled={isRunningShareCheck}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningShareCheck ? 'Running...' : 'Run Share Cross-Check'}
          </button>
        </div>

        {shareResult ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(shareResult, null, 2)}</pre>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <h2 className="text-base font-semibold text-slate-900">2) Cross-check Badge From Upload File</h2>
        <p className="mt-1 text-sm text-slate-600">Calls <span className="font-mono">POST /api/attendance/internal/crosscheck-badges</span>.</p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-72 flex-1">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Badge File (.TAF)</span>
            <input
              type="file"
              accept=".taf,.TAF,text/plain"
              onChange={(e) => setBadgeFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold"
            />
          </label>

          <button
            type="button"
            onClick={onRunUploadCrossCheck}
            disabled={isRunningUploadCheck}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningUploadCheck ? 'Running...' : 'Run Upload Cross-Check'}
          </button>
        </div>

        {uploadResult ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(uploadResult, null, 2)}</pre>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <h2 className="text-base font-semibold text-slate-900">3) Send Notification Email</h2>
        <p className="mt-1 text-sm text-slate-600">Calls <span className="font-mono">POST /api/notifications/email</span>.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">To (single)</span>
            <input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="manager@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Recipients (multi, comma/semicolon)</span>
            <input
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder="a@company.com; b@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Subject</span>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeAttendanceTable}
                onChange={(e) => setIncludeAttendanceTable(e.target.checked)}
                className="h-4 w-4"
              />
              Include attendance table
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <span>Date:</span>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {!includeAttendanceTable ? (
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Body</span>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onSendEmail}
            disabled={isSendingEmail || !canSubmitEmail}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSendingEmail ? 'Sending...' : 'Send Email'}
          </button>
        </div>

        {emailResult ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(emailResult, null, 2)}</pre>
        ) : null}
      </section>
    </div>
  )
}

export default ApiToolsPage
