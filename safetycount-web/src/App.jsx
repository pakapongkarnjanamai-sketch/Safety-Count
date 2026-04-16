import MorningCheckIn from './components/MorningCheckIn'
import EvacuationCheckIn from './components/EvacuationCheckIn'

function App() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">SafetyCount</h1>
        <p className="mt-2 text-slate-600">Daily attendance and emergency safety confirmation dashboard.</p>
      </header>

      <MorningCheckIn />
      <EvacuationCheckIn />
    </main>
  )
}

export default App
