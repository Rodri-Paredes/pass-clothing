import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import BranchSelectionPage from './pages/BranchSelectionPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import DropsPage from './pages/DropsPage';
import SalesPage from './pages/SalesPage';
import Layout from './components/layout/Layout';
import CashClosurePage from './pages/CashClosurePage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import DiscountsPage from './pages/DiscountsPage';
import HealthDashboardPage from './pages/HealthDashboardPage';
import CustomersPage from './pages/CustomersPage';
import SalesStatisticsPage from './pages/SalesStatisticsPage';
import PassCrewPage from './pages/PassCrewPage';
import ToastContainer from './components/ui/Toast';

function App() {
  const { user, activeBranch, isLoading, isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!activeBranch) {
    return <BranchSelectionPage />;
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/drops" element={user?.role === 'admin' ? <DropsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/discounts" element={user?.role === 'admin' ? <DiscountsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/customers" element={user?.role === 'admin' ? <CustomersPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/sales-statistics" element={user?.role === 'admin' ? <SalesStatisticsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/pass-crew" element={user?.role === 'admin' ? <PassCrewPage /> : <Navigate to="/dashboard" replace />} />
          {/* <Route path="/reports" element={<DashboardPage />} /> */}
          <Route path="/cash-closure" element={<CashClosurePage />} />
          {/* <Route path="/diagnostic" element={<DiagnosticPage />} />
          <Route path="/cash-flow" element={<CashFlowPage />} /> */}
          {user?.role === 'admin' && (
            <>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/health" element={<HealthDashboardPage />} />
            </>
          )}
        </Route>
      </Routes>
    </>
  );
}

export default App;
