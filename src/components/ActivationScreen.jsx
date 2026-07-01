import React, { useState, useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { Key, Lock, Laptop, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ActivationScreen() {
  const {
    deviceId,
    deviceName,
    activationState,
    licenseDetails,
    activateLicense,
    adminLogin,
    setActiveView,
    serverUrl
  } = useContext(TallyContext);

  const [inputUserId, setInputUserId] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admin login flow states
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleActivate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const res = await activateLicense(inputUserId, inputKey, false);
    if (res.success) {
      setSuccessMsg("Application activated successfully!");
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    const res = await adminLogin(adminPassword);
    if (res.success) {
      setAdminPassword('');
      setActiveView('admin_portal');
    } else {
      setAdminError(res.error);
    }
  };

  const getStatusDisplay = () => {
    switch (activationState) {
      case 'expired':
        return {
          title: "License Expired",
          desc: "login limit and peroid exceed, please contact Admin",
          type: "error"
        };
      case 'device_limit_exceeded':
        return {
          title: "Computer seat limit exceeded",
          desc: "login limit and peroid exceed, please contact Admin",
          type: "error"
        };
      case 'invalid_key':
        return {
          title: "Invalid Activation Key",
          desc: "The username or license key entered is incorrect. Keys must match the registered User Login ID exactly.",
          type: "error"
        };
      case 'server_disconnected':
        return {
          title: "Licensing Server Disconnected",
          desc: `Cannot connect to the central licensing server at '${serverUrl || 'http://10.179.213.170/'}'. Please verify the server is running on the host or contact your system administrator.`,
          type: "error"
        };
      default:
        return {
          title: "License Verification",
          desc: "Welcome to Tally Accounting Solutions. To run the application, please enter your User ID and the License Key provided by your administrator.",
          type: "info"
        };
    }
  };



  const status = getStatusDisplay();

  return (
    <div className="activation-overlay">
      <div className="activation-container-centered">
        
        {showAdminPanel ? (
          /* Admin Unlock Form Card */
          <div className="activation-card glass-center-card">
            <div className="activation-header">
              <div className="logo-badge" style={{ background: 'rgba(192, 132, 252, 0.1)', borderColor: 'rgba(192, 132, 252, 0.2)' }}>
                <ShieldAlert size={24} style={{ color: '#c084fc' }} />
              </div>
              <h2>ADMIN REGISTRY PORTAL</h2>
              <p>System Key & Node Management Console</p>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className="activation-form">
              <div className="form-group">
                <label>Administrator Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} className="key-icon-input" />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {adminError && <div className="form-alert alert-error">{adminError}</div>}

              <button type="submit" className="btn-primary btn-block" style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)' }}>
                Unlock Central Console
              </button>
              
              <button 
                type="button" 
                className="btn-secondary btn-block" 
                onClick={() => {
                  setShowAdminPanel(false);
                  setAdminError('');
                }}
              >
                Back to Activation
              </button>
            </form>
          </div>
        ) : (
          /* Normal Customer Activation/Login Form Card */
          <div className="activation-card glass-center-card">
            <div className="activation-header">
              <div className="logo-badge">
                <Lock size={24} style={{ color: '#818cf8' }} />
              </div>
              <h2>TALLY SOLUTIONS</h2>
              <p>Accounting Application v1.0</p>
            </div>

            {/* Status Alert Banner */}
            <div className={`status-banner banner-${status.type}`}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <h4>{status.title}</h4>
                <p>{status.desc}</p>
              </div>
            </div>

            <form onSubmit={handleActivate} className="activation-form">
              <div className="form-group">
                <label>User Login ID</label>
                <input
                  type="text"
                  placeholder="e.g. ClientCompany"
                  value={inputUserId}
                  onChange={(e) => setInputUserId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>License Key</label>
                <div style={{ position: 'relative' }}>
                  <Key size={18} className="key-icon-input" />
                  <input
                    type="text"
                    placeholder="TALLY-btoa..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                    required
                  />
                </div>
              </div>

              {errorMsg && <div className="form-alert alert-error">{errorMsg}</div>}
              {successMsg && <div className="form-alert alert-success">{successMsg}</div>}

              <button type="submit" className="btn-primary btn-block">
                <CheckCircle2 size={16} />
                Activate & Launch
              </button>
            </form>

            {/* Current PC Status */}
            <div className="activation-pc-badge" style={{ margin: '20px 0 10px 0' }}>
              <Laptop size={14} />
              <span>
                Workstation Node: <strong>{deviceName}</strong> (ID: {deviceId})
              </span>
            </div>

            {/* Gate to Admin Owner portal */}
            <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Are you the Admin Owner? </span>
              <button 
                type="button" 
                className="admin-link-btn" 
                onClick={() => setShowAdminPanel(true)}
              >
                Go to Admin Portal
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
