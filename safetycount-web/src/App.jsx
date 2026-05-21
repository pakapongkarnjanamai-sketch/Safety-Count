import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import AttendancePage from './pages/AttendancePage'
import HistoryPage from './pages/HistoryPage'
import ApiToolsPage from './pages/ApiToolsPage'
import MonthlyPivotPage from './pages/MonthlyPivotPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/monthly-pivot" element={<MonthlyPivotPage />} />
          <Route path="/api-tools" element={<ApiToolsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
