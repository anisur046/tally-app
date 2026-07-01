import React, { useContext } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Vouchers from './components/Vouchers';
import Ledgers from './components/Ledgers';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import LicenseManager from './components/LicenseManager';
import ActivationScreen from './components/ActivationScreen';
import AdminPortal from './components/AdminPortal';
import CompanyDetails from './components/CompanyDetails';
import { TallyContext, TallyProvider } from './context/TallyContext';
import { BookOpen } from 'lucide-react';

function AppContent() {
  const { activeView, setActiveView, companyDetails, activationState, isAdminLoggedIn } = useContext(TallyContext);

  React.useEffect(() => {
    if (activeView === 'admin_portal' && !isAdminLoggedIn) {
      setActiveView('dashboard');
    }
  }, [activeView, isAdminLoggedIn, setActiveView]);

  if (activationState !== 'activated' && !isAdminLoggedIn) {
    return <ActivationScreen />;
  }

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <main className="main-content">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="company-title">
            <h1>{companyDetails.name}</h1>
            <p>{companyDetails.address} | GSTIN: {companyDetails.gstin}</p>
          </div>

          <div className="top-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
              <BookOpen size={16} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Session: {companyDetails.financialYear}
              </span>
            </div>
          </div>
        </header>

        {/* View Switcher Routing */}
        <div style={{ flexGrow: 1 }}>
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'company_details' && <CompanyDetails />}
          {activeView === 'vouchers' && <Vouchers />}
          {activeView === 'ledgers' && <Ledgers />}
          {activeView === 'inventory' && <Inventory />}
          {activeView === 'reports' && <Reports />}
          {activeView === 'license' && <LicenseManager />}
          {activeView === 'admin_portal' && isAdminLoggedIn && <AdminPortal />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <TallyProvider>
      <AppContent />
    </TallyProvider>
  );
}
