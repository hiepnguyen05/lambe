import { CustomerApp } from './app/CustomerApp'
import { isAdminRoute } from './app/routes'
import { AdminLoginScreen } from './features/admin/components/AdminLoginScreen'

function App() {
  return isAdminRoute(window.location.pathname) ? (
    <AdminLoginScreen />
  ) : (
    <CustomerApp />
  )
}

export default App
