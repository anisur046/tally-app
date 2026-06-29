import React, { useState, useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { Shield, Key, Laptop, User, Calendar, Copy, Trash2 } from 'lucide-react';

export default function LicenseManager() {
  const {
    deviceId,
    deviceName,
    userId,
    licenseKey,
    licenseDetails,
    deactivateLicense,
    revokeDevice,
    updateDeviceName,
    licensingMode,
    serverUrl,
    serverStatus
  } = useContext(TallyContext);

  // States for renaming current device
  const [editingName, setEditingName] = useState(false);
  const [tempDeviceName, setTempDeviceName] = useState(deviceName);

  const handleCopyKey = () => {
    if (!licenseKey) return;
    navigator.clipboard.writeText(licenseKey);
    alert('License key copied to clipboard!');
  };

  const handleRenameDevice = (e) => {
    e.preventDefault();
    updateDeviceName(tempDeviceName);
    setEditingName(false);
  };

  // Expiration calculation helper
  const getExpirationText = () => {
    if (!licenseDetails) return "n/a";
    const expDate = new Date(licenseDetails.expiresAt);
    const diffTime = licenseDetails.expiresAt - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Expired on ${expDate.toLocaleDateString()}`;
    }
    return `${expDate.toLocaleDateString()} (${diffDays} days remaining)`;
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Shield size={28} style={{ color: '#818cf8' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>License Settings</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            View active seat allocations, validity dates, and authorized nodes.
          </p>
        </div>
      </div>

      <div className="license-grid">
        
        {/* Left Column: Active License & Current Device */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active License Details Card */}
          <div className="license-card-new">
            <div className="license-card-header">
              <Shield size={20} className="header-icon-active" />
              <h3>Current License Details</h3>
              <span className="badge-activated">Active</span>
            </div>
            
            <div className="license-card-body">
              <div className="info-row">
                <User size={16} />
                <div className="info-content">
                  <span className="info-label">User Login ID</span>
                  <span className="info-value">{userId}</span>
                </div>
              </div>

              <div className="info-row">
                <Key size={16} />
                <div className="info-content" style={{ flexGrow: 1 }}>
                  <span className="info-label">License Key</span>
                  <span className="info-value text-truncate" style={{ maxWidth: '240px', display: 'inline-block' }}>
                    {licenseKey}
                  </span>
                </div>
                <button className="btn-icon" onClick={handleCopyKey} title="Copy Key">
                  <Copy size={16} />
                </button>
              </div>

              <div className="info-row">
                <Calendar size={16} />
                <div className="info-content">
                  <span className="info-label">Validity Expiration</span>
                  <span className="info-value">{getExpirationText()}</span>
                </div>
              </div>

              <div className="info-row">
                <Laptop size={16} />
                <div className="info-content">
                  <span className="info-label">Computer Seat Limit</span>
                  <span className="info-value">
                    {licenseDetails?.registeredDevices?.length || 0} of {licenseDetails?.deviceLimit || 1} Seats Used
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }}>
                <button className="btn-danger" style={{ width: '100%' }} onClick={deactivateLicense}>
                  Deactivate License (Logout)
                </button>
              </div>
            </div>
          </div>

          {/* Current Device Details Card */}
          <div className="license-card-new">
            <div className="license-card-header">
              <Laptop size={20} style={{ color: '#38bdf8' }} />
              <h3>Local Machine Profile</h3>
            </div>
            
            <div className="license-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span className="info-label">Hardware Device ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <code className="code-id">{deviceId}</code>
                    <span className="tag-this-device">This Computer</span>
                  </div>
                </div>

                <div>
                  <span className="info-label">Device Display Name</span>
                  {editingName ? (
                    <form onSubmit={handleRenameDevice} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input
                        type="text"
                        value={tempDeviceName}
                        onChange={(e) => setTempDeviceName(e.target.value)}
                        style={{ flexGrow: 1, padding: '6px 12px' }}
                        required
                      />
                      <button type="submit" className="btn-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        Save
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => {
                          setTempDeviceName(deviceName);
                          setEditingName(false);
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className="info-value" style={{ fontWeight: 600 }}>{deviceName}</span>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }} 
                        onClick={() => setEditingName(true)}
                      >
                        Rename
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Licensing Server Profile Card */}
          <div className="license-card-new">
            <div className="license-card-header">
              <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>🔌</span>
              <h3>Licensing Server Profile</h3>
            </div>
            
            <div className="license-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span className="info-label">Licensing Mode</span>
                  <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    {licensingMode === 'server' ? 'Central Network Server' : 'Offline Simulated Sandbox'}
                  </div>
                </div>

                {licensingMode === 'server' && (
                  <>
                    <div>
                      <span className="info-label">Central Server URL</span>
                      <div style={{ marginTop: '4px' }}>
                        <code className="code-id">{serverUrl || window.location.origin}</code>
                      </div>
                    </div>

                    <div>
                      <span className="info-label">Connection Status</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        {serverStatus === 'connected' ? (
                          <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            ● Connected
                          </span>
                        ) : serverStatus === 'disconnected' ? (
                          <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            ● Disconnected
                          </span>
                        ) : (
                          <span style={{ color: '#eab308', fontWeight: 600, fontSize: '0.8rem' }}>
                            ● Not Checked
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Registered Devices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active Devices Registry List */}
          <div className="license-card-new">
            <div className="license-card-header">
              <Laptop size={20} style={{ color: '#10b981' }} />
              <h3>Activated Devices Registry</h3>
            </div>
            
            <div className="license-card-body" style={{ padding: '0 20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '16px 0 8px 0' }}>
                The following workstations are activated under your license key. You can revoke older or inactive computers to free up a seat.
              </p>
              
              <div className="device-list-container">
                {licenseDetails?.registeredDevices?.map((dev) => (
                  <div 
                    key={dev.deviceId} 
                    className={`device-registry-row ${dev.deviceId === deviceId ? 'highlight-row' : ''}`}
                  >
                    <Laptop size={18} style={{ color: dev.deviceId === deviceId ? '#818cf8' : 'var(--text-muted)' }} />
                    <div className="device-registry-details">
                      <span className="device-name-text">
                        {dev.deviceName} {dev.deviceId === deviceId && <span className="current-badge">(This PC)</span>}
                      </span>
                      <span className="device-id-text">ID: {dev.deviceId} | Activated {new Date(dev.activatedAt).toLocaleDateString()}</span>
                    </div>
                    {dev.deviceId !== deviceId ? (
                      <button 
                        className="btn-revoke" 
                        onClick={() => {
                          if (window.confirm(`Revoke activation for ${dev.deviceName}? This device will be logged out immediately.`)) {
                            revokeDevice(dev.deviceId);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        Revoke
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)' }}>Active</span>
                    )}
                  </div>
                ))}

                {(!licenseDetails?.registeredDevices || licenseDetails.registeredDevices.length === 0) && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No devices registered.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
