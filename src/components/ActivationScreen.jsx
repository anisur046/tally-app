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
    importData,
    licensingMode,
    setLicensingMode,
    serverUrl,
    setServerUrl,
    serverStatus,
    checkServerConnection
  } = useContext(TallyContext);

  const [showSettings, setShowSettings] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    await checkServerConnection(tempServerUrl);
    setTestingConnection(false);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setServerUrl(tempServerUrl);
    alert("Server URL settings saved successfully!");
  };

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

    const res = await activateLicense(inputUserId, inputKey);
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
          desc: `Your license key for user "${licenseDetails?.userId || 'n/a'}" has expired. Please contact your system administrator to buy or renew your license key.`,
          type: "error"
        };
      case 'device_limit_exceeded':
        return {
          title: "Computer seat limit exceeded",
          desc: `This license key has a maximum limit of ${licenseDetails?.deviceLimit} computer(s) and is already active on other workstations. Please ask your administrator to revoke a device from the central registry or buy additional seats.`,
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
          desc: `Cannot connect to the central licensing server at '${serverUrl || 'http://10.179.213.170/'}'. Please verify the server is running on the host and check connection settings below.`,
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
                    placeholder="Enter password (default: admin123)"
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

            {/* Collapsible Server Connection settings */}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '12px' }}>
              <button 
                type="button" 
                className="admin-link-btn" 
                onClick={() => setShowSettings(!showSettings)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}
              >
                🔌 {showSettings ? "Hide Server Settings" : "Show Licensing Server Settings"}
              </button>
              
              {showSettings && (
                <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.7rem' }}>Licensing Mode</label>
                    <select
                      value={licensingMode}
                      onChange={(e) => setLicensingMode(e.target.value)}
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}
                    >
                      <option value="server">Central Network Server</option>
                      <option value="simulated">Simulated Offline Mode</option>
                    </select>
                  </div>
                  
                  {licensingMode === 'server' && (
                    <>
                      <div className="form-group" style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '0.7rem' }}>Licensing Server URL</label>
                        <input
                          type="text"
                          placeholder="e.g. http://localhost:3001 or empty for relative"
                          value={tempServerUrl}
                          onChange={(e) => setTempServerUrl(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                        />
                        <span className="input-tip" style={{ fontSize: '0.65rem', marginTop: '2px', display: 'block', color: 'var(--text-muted)' }}>
                          Leave blank to use the active web host URL.
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Status:</span>
                          {serverStatus === 'connected' ? (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                              ● Connected
                            </span>
                          ) : serverStatus === 'disconnected' ? (
                            <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                              ● Disconnected
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: 600 }}>
                              ● Not Checked
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', margin: 0 }}
                          >
                            {testingConnection ? "Pinging..." : "Ping"}
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleSaveSettings}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', margin: 0, background: '#818cf8', border: 'none' }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Gate to Admin Owner portal */}
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Are you the Admin Owner? </span>
              <button 
                type="button" 
                className="admin-link-btn" 
                onClick={() => setShowAdminPanel(true)}
              >
                Go to Admin Portal
              </button>
            </div>

            {/* Restore from Backup option */}
            <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Have a system backup? </span>
              <button 
                type="button" 
                className="admin-link-btn" 
                onClick={() => document.getElementById('activation-restore-input')?.click()}
                style={{ color: '#818cf8', fontWeight: 600 }}
              >
                Restore System Backup
              </button>
              <input 
                type="file" 
                id="activation-restore-input" 
                onChange={importData} 
                style={{ display: 'none' }} 
                accept=".json" 
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
