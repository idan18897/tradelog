import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'
import StreakToast from './StreakToast'

export default function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <StreakToast />
      <TopNav />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
