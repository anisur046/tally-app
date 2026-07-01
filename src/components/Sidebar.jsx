import React, { useContext, useRef } from 'react';
import { TallyContext } from '../context/TallyContext';
import { 
  LayoutDashboard, 
  Building2,
  Receipt, 
  BookOpen, 
  Package, 
  BarChart3, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2,
  Bookmark,
  Shield,
  LogOut,
  Database
} from 'lucide-react';

export default function Sidebar() {
  const { 
    activeView, 
    setActiveView, 
    resetToDefault, 
    clearAllData, 
    exportData, 
    importData,
    companyDetails,
    userId,
    deviceId,
    deactivateLicense,
    isAdminLoggedIn,
    adminLogout
  } = useContext(TallyContext);

  const fileInputRef = useRef(null);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'company_details', name: 'Company Details', icon: Building2 },
    { id: 'vouchers', name: 'Voucher Entry', icon: Receipt },
    { id: 'ledgers', name: 'Ledgers (Accounts)', icon: BookOpen },
    { id: 'inventory', name: 'Inventory (Stock)', icon: Package },
    { id: 'reports', name: 'Financial Reports', icon: BarChart3 },
  ];

  if (isAdminLoggedIn) {
    menuItems.push({ id: 'admin_portal', name: 'Admin Registry', icon: Database });
  } else {
    menuItems.push({ id: 'license', name: 'License Settings', icon: Shield });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Bookmark className="w-6 h-6 text-indigo-500 fill-indigo-500" style={{ color: '#818cf8', fill: '#818cf8' }} />
        <span>TALLY REACT</span>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <div 
                className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </div>
            </li>
          );
        })}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', paddingLeft: '16px', marginBottom: '8px' }}>
            System Tools
          </p>
          <li>
            <div className="sidebar-item" onClick={exportData}>
              <Download size={16} />
              <span>Backup (Export)</span>
            </div>
          </li>
          <li>
            <div className="sidebar-item" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              <span>Restore (Import)</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={importData} 
                style={{ display: 'none' }} 
                accept=".json" 
              />
            </div>
          </li>
          <li>
            <div className="sidebar-item" onClick={resetToDefault}>
              <RefreshCw size={16} />
              <span>Reset Sample Data</span>
            </div>
          </li>
          <li>
            <div className="sidebar-item" style={{ color: 'var(--color-error)' }} onClick={clearAllData}>
              <Trash2 size={16} />
              <span>Wipe All Data</span>
            </div>
          </li>
        </div>
      </ul>

      <div className="sidebar-footer">
        <div>FY: {companyDetails.financialYear}</div>
        
        {isAdminLoggedIn ? (
          <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(192, 132, 252, 0.05)', border: '1px solid rgba(192, 132, 252, 0.2)', fontSize: '0.7rem' }}>
            <div style={{ fontWeight: 600, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc', display: 'inline-block' }}></span>
              <span>Administrator</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                System Owner
              </span>
              <button 
                onClick={adminLogout}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: 0, 
                  color: '#fca5a5', 
                  cursor: 'pointer', 
                  fontSize: '0.65rem', 
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--color-error)'}
                onMouseLeave={(e) => e.target.style.color = '#fca5a5'}
                title="Log Out Admin"
              >
                <LogOut size={10} style={{ pointerEvents: 'none' }} />
                Log Out
              </button>
            </div>
          </div>
        ) : userId ? (
          <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>User: {userId}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                PC: {deviceId}
              </span>
              <button 
                onClick={deactivateLicense}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: 0, 
                  color: '#fca5a5', 
                  cursor: 'pointer', 
                  fontSize: '0.65rem', 
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--color-error)'}
                onMouseLeave={(e) => e.target.style.color = '#fca5a5'}
                title="Log Out (Deactivate)"
              >
                <LogOut size={10} style={{ pointerEvents: 'none' }} />
                Log Out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
