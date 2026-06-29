import React, { useState, useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { Database, Key, Laptop, Copy, Trash2, ShieldAlert, CheckCircle2, Plus } from 'lucide-react';

export default function AdminPortal() {
  const {
    generatedLicenses,
    generateAndRegisterKey,
    globalRevokeDevice,
    globalDeleteLicense,
    renewLicenseKey,
    licensingMode,
    serverLicenses,
    serverRegistry
  } = useContext(TallyContext);

  // Key generator form state
  const [formUserId, setFormUserId] = useState('');
  const [formDeviceLimit, setFormDeviceLimit] = useState(1);
  const [formValidityYears, setFormValidityYears] = useState(1);
  const [newKey, setNewKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Active license list expansion state
  const [expandedKey, setExpandedKey] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formUserId.trim()) return;
    const res = await generateAndRegisterKey(formUserId, formDeviceLimit, formValidityYears);
    if (res.success) {
      setNewKey(res.key);
      setExpandedKey(res.key);
      setFormUserId(''); // Clear the input field
    } else {
      setErrorMsg(res.error);
      setNewKey('');
    }
  };

  const handleCopyNewKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleCopyExistingKey = (key) => {
    navigator.clipboard.writeText(key);
    alert('Key copied to clipboard!');
  };

  // Helper to query active devices for a key
  const getActiveDevicesForKey = (key) => {
    try {
      if (licensingMode === 'server') {
        return serverRegistry[key]?.devices || [];
      } else {
        const central = JSON.parse(localStorage.getItem('tally_central_licenses')) || {};
        return central[key]?.devices || [];
      }
    } catch {
      return [];
    }
  };

  const activeLicensesList = licensingMode === 'server' ? serverLicenses : generatedLicenses;

  const getLicenseStatus = (license) => {
    const isExpired = Date.now() > license.expiresAt;
    if (isExpired) return { label: 'Expired', className: 'status-tag-expired' };
    
    const activeDevices = getActiveDevicesForKey(license.key);
    if (activeDevices.length >= license.deviceLimit) {
      return { label: 'Full', className: 'status-tag-full' };
    }
    
    return { label: 'Active', className: 'status-tag-valid' };
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Database size={28} style={{ color: '#c084fc' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Tally Central Registry</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            System Administration Console & Key Database
          </p>
        </div>
      </div>

      <div className="admin-content-grid">
          
          {/* Left Column: Key Generator */}
          <div className="admin-card-new">
            <div className="admin-card-header">
              <Key size={18} style={{ color: '#c084fc' }} />
              <h3>Generate Customer License Key</h3>
            </div>
            
            <div className="admin-card-body">
              <form onSubmit={handleGenerate} className="admin-gen-form">
                <div className="form-group">
                  <label>Customer User Login ID</label>
                  <input
                    type="text"
                    placeholder="e.g. AcmeCorp or client@domain.com"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    required
                  />
                  <span className="input-tip">This is the unique ID the customer will use to log in.</span>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Computer Seats (Limit)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formDeviceLimit}
                      onChange={(e) => setFormDeviceLimit(parseInt(e.target.value, 10))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Years Valid</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={formValidityYears}
                      onChange={(e) => setFormValidityYears(parseFloat(e.target.value))}
                      required
                    />
                  </div>
                </div>

                {errorMsg && <div className="form-alert alert-error" style={{ margin: '8px 0 16px 0' }}>{errorMsg}</div>}

                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '12px' }}>
                  <Plus size={16} />
                  Create Customer License
                </button>
              </form>

              {newKey && (
                <div className="generated-key-container" style={{ marginTop: '24px' }}>
                  <span className="info-label" style={{ color: '#a7f3d0' }}>Generated License Key (Provide to Client)</span>
                  <div className="key-output-box" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    <code>{newKey}</code>
                    <button 
                      type="button" 
                      className={`btn-icon ${copySuccess ? 'copy-success' : ''}`} 
                      onClick={handleCopyNewKey}
                    >
                      {copySuccess ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <span className="input-tip" style={{ color: 'var(--text-secondary)' }}>
                    Share the Login ID (<strong>{formUserId}</strong>) and this Key with the customer.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Database License Database */}
          <div className="admin-card-new">
            <div className="admin-card-header">
              <Database size={18} style={{ color: '#10b981' }} />
              <h3>Client License Database ({activeLicensesList.length})</h3>
            </div>
            
            <div className="admin-card-body" style={{ padding: 0 }}>
              <div className="license-table-container">
                {activeLicensesList.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ShieldAlert size={32} style={{ marginBottom: '12px', color: 'var(--text-muted)' }} />
                    <p>No license keys have been generated yet.</p>
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Seats Used</th>
                        <th>Expiration</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLicensesList.map((lic) => {
                        const activeDevices = getActiveDevicesForKey(lic.key);
                        const isExpanded = expandedKey === lic.key;
                        const statusInfo = getLicenseStatus(lic);
                        
                        return (
                          <React.Fragment key={lic.key}>
                            {/* Main License Row */}
                            <tr 
                              className={`license-row-main ${isExpanded ? 'expanded-row-bg' : ''}`}
                              onClick={() => setExpandedKey(isExpanded ? null : lic.key)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lic.userId}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {lic.key.substring(0, 18)}...
                                </div>
                              </td>
                              <td>
                                {activeDevices.length} / {lic.deviceLimit}
                              </td>
                              <td style={{ fontSize: '0.75rem' }}>
                                {new Date(lic.expiresAt).toLocaleDateString()}
                              </td>
                              <td>
                                <span className={`status-tag ${statusInfo.className}`}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                  <button className="btn-icon" onClick={() => handleCopyExistingKey(lic.key)} title="Copy Full Key">
                                    <Copy size={12} />
                                  </button>
                                  <button 
                                     className="btn-icon" 
                                     style={{ color: 'var(--color-error)' }}
                                     onClick={async () => {
                                       if (window.confirm(`Revoke and DELETE this license for '${lic.userId}'? The client will be logged out and locked immediately.`)) {
                                         await globalDeleteLicense(lic.key);
                                       }
                                     }}
                                     title="Revoke License completely"
                                   >
                                     <Trash2 size={12} />
                                   </button>
                                 </div>
                               </td>
                            </tr>
                            
                            {/* Expandable Device Sessions Row */}
                            {isExpanded && (
                              <tr className="device-expand-row">
                                <td colSpan="5">
                                  <div className="expanded-devices-container">
                                    <div className="expand-header-sub">
                                      <Laptop size={14} style={{ color: '#818cf8' }} />
                                      <span>Active Registered Devices ({activeDevices.length})</span>
                                    </div>
                                    
                                    {activeDevices.length === 0 ? (
                                      <p className="no-devices-text">This key has not been activated on any computer yet.</p>
                                    ) : (
                                      <div className="expanded-dev-list">
                                        {activeDevices.map((dev) => (
                                          <div key={dev.deviceId} className="expanded-dev-row">
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                              <span className="dev-name">{dev.deviceName}</span>
                                              <code className="dev-code">ID: {dev.deviceId} | Activated {new Date(dev.activatedAt).toLocaleDateString()}</code>
                                            </div>
                                            <button 
                                              className="btn-revoke-sub"
                                              onClick={async () => {
                                                if (window.confirm(`Revoke session for ${dev.deviceName}?`)) {
                                                  await globalRevokeDevice(lic.key, dev.deviceId);
                                                  // Keep expanded
                                                  setExpandedKey(lic.key);
                                                }
                                              }}
                                            >
                                              Revoke Seat
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="license-info-card-expanded">
                                      <strong>Full License Key:</strong>
                                      <code style={{ wordBreak: 'break-all', display: 'block', marginTop: '4px', color: '#c084fc', fontSize: '0.7rem' }}>
                                        {lic.key}
                                      </code>
                                    </div>

                                     {/* Renewal Controls */}
                                     <div className="license-info-card-expanded" style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                       <strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: '8px' }}>Renew / Adjust License Validity</strong>
                                       <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                         <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Adjust Period:</span>
                                         <select 
                                           id={`renew-years-${lic.key}`} 
                                           defaultValue="1" 
                                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}
                                         >
                                           <option value="-2">Decrease -2 Years</option>
                                           <option value="-1">Decrease -1 Year</option>
                                           <option value="-0.5">Decrease -6 Months</option>
                                           <option value="0.5">Extend +6 Months</option>
                                           <option value="1">Extend +1 Year</option>
                                           <option value="2">Extend +2 Years</option>
                                           <option value="3">Extend +3 Years</option>
                                           <option value="5">Extend +5 Years</option>
                                         </select>
                                         <button 
                                            className="btn-success" 
                                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                            onClick={async () => {
                                              const selectEl = document.getElementById(`renew-years-${lic.key}`);
                                              const years = parseFloat(selectEl.value);
                                              const res = await renewLicenseKey(lic.key, years);
                                              if (res.success) {
                                                alert(years > 0 ? `License successfully extended!` : `License validity successfully decreased!`);
                                                setExpandedKey(res.key);
                                              } else {
                                                alert(`Failed to adjust license: ${res.error}`);
                                              }
                                            }}
                                          >
                                            Apply Adjustment
                                          </button>
                                       </div>
                                     </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
  );
}
