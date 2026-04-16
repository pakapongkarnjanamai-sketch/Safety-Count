const VARIANTS = {
  present: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Present',
  },
  absent: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Absent',
  },
  safe: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Safe',
  },
  missing: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Missing',
  },
  injured: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Injured',
  },
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Pending',
  },
}

function StatusBadge({ variant = 'pending', label }) {
  const v = VARIANTS[variant] ?? VARIANTS.pending
  const displayLabel = label ?? v.label

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${v.bg} ${v.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {displayLabel}
    </span>
  )
}

export default StatusBadge
