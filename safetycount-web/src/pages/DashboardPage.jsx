import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'

function formatDateParam(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DashboardPage() {
  const today = formatDateParam(new Date())
  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, absentToday: 0 })
  const [isLoading, setIsLoading] = useState(true)

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
        try {
          const attRes = await fetch(`/api/attendance/${today}`)
          if (attRes.ok) {
            const attData = await attRes.json()
            if (Array.isArray(attData) && attData.length > 0) {
              presentToday = attData.filter((r) => r.isPresent).length
              absentToday = attData.filter((r) => !r.isPresent).length
            }
          }
        } catch { /* ignore */ }

        if (isMounted) {
          setStats({ totalEmployees, presentToday, absentToday })
        }
      } catch { /* ignore */ } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadStats()
    return () => { isMounted = false }
  }, [today])

  const quickActions = [
    {
      to: '/employees',
      label: 'Manage Employees',
      description: 'Add, remove, or sync employees',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
        </svg>
      ),
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      to: '/attendance',
      label: 'Take Attendance',
      description: 'Mark absent employees for today',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      ),
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      to: '/history',
      label: 'View History',
      description: 'Review or edit past attendance records',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Z" clipRule="evenodd" />
        </svg>
      ),
      gradient: 'from-emerald-500 to-teal-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Quick Actions</h2>
        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all duration-300 hover:shadow-md hover:ring-slate-300/80 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                  {action.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{action.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm font-medium text-indigo-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Go to page
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-1 h-4 w-4">
                  <path fillRule="evenodd" d="M5 10a.75.75 0 0 1 .75-.75h6.638L10.23 7.29a.75.75 0 1 1 1.04-1.08l3.5 3.25a.75.75 0 0 1 0 1.08l-3.5 3.25a.75.75 0 1 1-1.04-1.08l2.158-1.96H5.75A.75.75 0 0 1 5 10Z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
