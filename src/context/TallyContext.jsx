import React, { createContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_LEDGERS, DEFAULT_STOCK_ITEMS, DEFAULT_TRANSACTIONS } from '../utils/mockData';
import { validateLicenseKey, generateLicenseKey } from '../utils/licenseEngine';

export const TallyContext = createContext();

// Simulated Cloud License Registry Database
const getCentralLicenses = () => {
  try {
    const raw = localStorage.getItem('tally_central_licenses');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCentralLicenses = (registry) => {
  localStorage.setItem('tally_central_licenses', JSON.stringify(registry));
};

// Simulated License Generation database
const getGeneratedLicenses = () => {
  try {
    const raw = localStorage.getItem('tally_generated_licenses');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveGeneratedLicenses = (list) => {
  localStorage.setItem('tally_generated_licenses', JSON.stringify(list));
};

export const TallyProvider = ({ children }) => {
  const storedUserIdAtMount = localStorage.getItem('tally_license_userid') || '';

  const [userId, setUserId] = useState(storedUserIdAtMount);
  const [loadedUserId, setLoadedUserId] = useState(storedUserIdAtMount);

  const getInitialData = (keySuffix, defaultValue) => {
    if (storedUserIdAtMount) {
      const userSpecificKey = `tally_${storedUserIdAtMount}_${keySuffix}`;
      const userSaved = localStorage.getItem(userSpecificKey);
      if (userSaved) {
        return JSON.parse(userSaved);
      }
      // Migration from global key
      const globalKey = `tally_${keySuffix}`;
      const globalSaved = localStorage.getItem(globalKey);
      if (globalSaved) {
        localStorage.setItem(userSpecificKey, globalSaved);
        localStorage.removeItem(globalKey);
        return JSON.parse(globalSaved);
      }
    }
    return defaultValue;
  };

  const [ledgers, setLedgers] = useState(() => getInitialData('ledgers', DEFAULT_LEDGERS));
  const [stockItems, setStockItems] = useState(() => getInitialData('stockItems', DEFAULT_STOCK_ITEMS));
  const [transactions, setTransactions] = useState(() => getInitialData('transactions', DEFAULT_TRANSACTIONS));

  const [activeView, setActiveView] = useState('dashboard');
  const [companyDetails, setCompanyDetails] = useState(() => {
    const defaultCompany = {
      name: 'Tally Accounting Solutions Ltd.',
      address: '404 Financial Tech Hub, Sector 62, Noida, India',
      gstin: '09AAACT2468A1Z5',
      financialYear: '2026-2027'
    };
    if (storedUserIdAtMount) {
      const userSpecificKey = `tally_${storedUserIdAtMount}_companyDetails`;
      const userSaved = localStorage.getItem(userSpecificKey);
      if (userSaved) {
        return JSON.parse(userSaved);
      }
    }
    return defaultCompany;
  });

  // --- ADMIN STATE ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('tally_admin_logged_in') === 'true';
  });

  const [generatedLicenses, setGeneratedLicenses] = useState(getGeneratedLicenses);

  // Sync generated licenses
  useEffect(() => {
    saveGeneratedLicenses(generatedLicenses);
  }, [generatedLicenses]);

  // --- LICENSING STATE ---
  const [deviceId, setDeviceId] = useState(() => {
    let id = localStorage.getItem('tally_device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      localStorage.setItem('tally_device_id', id);
    }
    return id;
  });

  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('tally_device_name') || 'Workstation 1';
  });


  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem('tally_license_key') || '';
  });

  const [activationState, setActivationState] = useState('unactivated');
  const [licenseDetails, setLicenseDetails] = useState(null);

  // --- SERVER CONFIG STATES ---
  const [licensingMode, setLicensingMode] = useState(() => {
    return localStorage.getItem('tally_licensing_mode') || 'server';
  });
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('tally_server_url') || '';
  });
  const [serverStatus, setServerStatus] = useState('unknown'); // 'connected' | 'disconnected' | 'unknown'
  const [serverLicenses, setServerLicenses] = useState([]);
  const [serverRegistry, setServerRegistry] = useState({});

  useEffect(() => {
    localStorage.setItem('tally_licensing_mode', licensingMode);
  }, [licensingMode]);

  useEffect(() => {
    localStorage.setItem('tally_server_url', serverUrl);
  }, [serverUrl]);

  const checkServerConnection = useCallback(async (urlInput) => {
    const targetUrl = urlInput !== undefined ? urlInput : serverUrl;
    try {
      const res = await fetch(`${targetUrl}/api/status`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      if (data && data.status === 'ok') {
        setServerStatus('connected');
        return true;
      }
    } catch {
      setServerStatus('disconnected');
    }
    return false;
  }, [serverUrl]);

  const fetchServerLicenses = useCallback(async () => {
    if (licensingMode !== 'server') return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/licenses`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        setServerLicenses(data.licenses || []);
        setServerRegistry(data.registry || {});
        setServerStatus('connected');
      }
    } catch {
      setServerStatus('disconnected');
    }
  }, [licensingMode, serverUrl]);

  // Re-verify the license status
  const checkLicenseStatus = useCallback(async () => {
    const storedKey = localStorage.getItem('tally_license_key');
    const storedUserId = localStorage.getItem('tally_license_userid');
    
    if (!storedKey || !storedUserId) {
      setActivationState('unactivated');
      setLicenseDetails(null);
      return;
    }

    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/licenses/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: storedUserId,
            licenseKey: storedKey,
            deviceId,
            deviceName
          }),
          signal: AbortSignal.timeout(3000)
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
          setActivationState('activated');
          setLicenseDetails({
            ...data.payload,
            registeredDevices: data.registeredDevices
          });
          setServerStatus('connected');
        } else {
          const errMsg = (data && data.error) ? data.error : '';
          if (errMsg.includes('expired')) {
            setActivationState('expired');
          } else if (errMsg.includes('limit reached') || errMsg.includes('exceeded')) {
            setActivationState('device_limit_exceeded');
          } else {
            setActivationState('invalid_key');
          }
          setLicenseDetails(null);
        }
      } catch (error) {
        console.error("License check connection failed:", error);
        setServerStatus('disconnected');
        setActivationState('server_disconnected');
      }
    } else {
      // --- AUTO-RENEWAL OVER-THE-AIR SYNC ---
      const allGen = getGeneratedLicenses();
      const matchingLicense = allGen.find(l => l.userId.toLowerCase() === storedUserId.toLowerCase());
      
      let activeKey = storedKey;
      if (matchingLicense && matchingLicense.key !== storedKey) {
        localStorage.setItem('tally_license_key', matchingLicense.key);
        setLicenseKey(matchingLicense.key);
        activeKey = matchingLicense.key;
      }

      const res = validateLicenseKey(activeKey);
      if (!res.valid) {
        setActivationState('invalid_key');
        setLicenseDetails(null);
        return;
      }

      const { payload } = res;

      if (storedUserId.trim().toLowerCase() !== payload.userId.toLowerCase()) {
        setActivationState('invalid_key');
        setLicenseDetails(null);
        return;
      }

      if (Date.now() > payload.expiresAt) {
        setActivationState('expired');
        setLicenseDetails({
          ...payload,
          registeredDevices: []
        });
        return;
      }

      const registry = getCentralLicenses();
      const serverEntry = registry[storedKey];

      if (!serverEntry) {
        const newRegistry = { ...registry };
        const initialDevices = [{ deviceId, deviceName, activatedAt: Date.now() }];
        newRegistry[storedKey] = {
          userId: payload.userId,
          deviceLimit: payload.deviceLimit,
          expiresAt: payload.expiresAt,
          devices: initialDevices
        };
        saveCentralLicenses(newRegistry);
        setActivationState('activated');
        setLicenseDetails({
          ...payload,
          registeredDevices: initialDevices
        });
        return;
      }

      const isRegistered = serverEntry.devices.some(d => d.deviceId === deviceId);

      if (!isRegistered) {
        if (serverEntry.devices.length < serverEntry.deviceLimit) {
          const updatedDevices = [...serverEntry.devices, { deviceId, deviceName, activatedAt: Date.now() }];
          const newRegistry = {
            ...registry,
            [storedKey]: {
              ...serverEntry,
              devices: updatedDevices
            }
          };
          saveCentralLicenses(newRegistry);
          setActivationState('activated');
          setLicenseDetails({
            ...payload,
            registeredDevices: updatedDevices
          });
        } else {
          setActivationState('device_limit_exceeded');
          setLicenseDetails({
            ...payload,
            registeredDevices: serverEntry.devices
          });
        }
      } else {
        let changed = false;
        const updatedDevices = serverEntry.devices.map(d => {
          if (d.deviceId === deviceId && d.deviceName !== deviceName) {
            changed = true;
            return { ...d, deviceName };
          }
          return d;
        });

        if (changed) {
          registry[storedKey].devices = updatedDevices;
          saveCentralLicenses(registry);
        }

        setActivationState('activated');
        setLicenseDetails({
          ...payload,
          registeredDevices: updatedDevices
        });
      }
    }
  }, [deviceId, deviceName, licensingMode, serverUrl]);

  // Run validation on mount & when state changes
  useEffect(() => {
    checkLicenseStatus();
  }, [checkLicenseStatus, licenseKey, userId, licensingMode, serverUrl]);

  // Keep admin licenses list synced
  useEffect(() => {
    if (licensingMode === 'server' && isAdminLoggedIn) {
      fetchServerLicenses();
    }
  }, [licensingMode, isAdminLoggedIn, fetchServerLicenses]);

  // Synchronize across tabs on storage change
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'tally_central_licenses' || e.key === 'tally_license_key' || e.key === 'tally_license_userid' || e.key === 'tally_device_id' || e.key === 'tally_device_name' || e.key === 'tally_generated_licenses' || e.key === 'tally_licensing_mode' || e.key === 'tally_server_url') {
        const storedKey = localStorage.getItem('tally_license_key') || '';
        const storedUserId = localStorage.getItem('tally_license_userid') || '';
        const storedDeviceId = localStorage.getItem('tally_device_id');
        const storedDeviceName = localStorage.getItem('tally_device_name');
        const storedMode = localStorage.getItem('tally_licensing_mode');
        const storedUrl = localStorage.getItem('tally_server_url');
        
        if (storedDeviceId && storedDeviceId !== deviceId) {
          setDeviceId(storedDeviceId);
        }
        if (storedDeviceName && storedDeviceName !== deviceName) {
          setDeviceName(storedDeviceName);
        }
        if (storedMode && storedMode !== licensingMode) {
          setLicensingMode(storedMode);
        }
        if (storedUrl !== null && storedUrl !== serverUrl) {
          setServerUrl(storedUrl);
        }
        setLicenseKey(storedKey);
        setUserId(storedUserId);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceId, deviceName, licensingMode, serverUrl]);

  // Activate license function
  const activateLicense = async (newUserId, newKey) => {
    const cleanUserId = newUserId.trim();
    const cleanKey = newKey.trim();

    if (!cleanUserId || !cleanKey) {
      return { success: false, error: "Please enter both User ID and License Key." };
    }

    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/licenses/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: cleanUserId,
            licenseKey: cleanKey,
            deviceId,
            deviceName
          }),
          signal: AbortSignal.timeout(5000)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('tally_license_key', cleanKey);
          localStorage.setItem('tally_license_userid', data.payload.userId);
          
          setLicenseKey(cleanKey);
          setUserId(data.payload.userId);
          setServerStatus('connected');
          return { success: true };
        } else {
          return { success: false, error: data.error || "Activation failed." };
        }
      } catch (error) {
        console.error("Activation server failed:", error);
        setServerStatus('disconnected');
        return { success: false, error: "Failed to connect to the licensing server. Please check the Server URL configuration." };
      }
    } else {
      const res = validateLicenseKey(cleanKey);
      if (!res.valid) {
        return { success: false, error: res.error };
      }

      const { payload } = res;

      if (cleanUserId.toLowerCase() !== payload.userId.toLowerCase()) {
        return { success: false, error: `This key belongs to User: '${payload.userId}'. The entered Login ID does not match.` };
      }

      if (Date.now() > payload.expiresAt) {
        return { success: false, error: "This license key has expired." };
      }

      const registry = getCentralLicenses();
      const serverEntry = registry[cleanKey];

      if (serverEntry) {
        const isRegistered = serverEntry.devices.some(d => d.deviceId === deviceId);
        if (!isRegistered && serverEntry.devices.length >= serverEntry.deviceLimit) {
          return {
            success: false,
            error: `Activation limit reached. This license is already in use on the maximum allowed ${serverEntry.deviceLimit} computer(s).`
          };
        }
      }

      localStorage.setItem('tally_license_key', cleanKey);
      localStorage.setItem('tally_license_userid', payload.userId);
      
      setLicenseKey(cleanKey);
      setUserId(payload.userId);
      return { success: true };
    }
  };

  // Deactivate/Logout license function
  const deactivateLicense = async () => {
    const storedKey = localStorage.getItem('tally_license_key');
    if (storedKey) {
      if (licensingMode === 'server') {
        try {
          await fetch(`${serverUrl}/api/licenses/deactivate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              licenseKey: storedKey,
              deviceId
            }),
            signal: AbortSignal.timeout(3000)
          });
        } catch (e) {
          console.error("Server deactivation failed, removing locally anyway", e);
        }
      } else {
        const registry = getCentralLicenses();
        if (registry[storedKey]) {
          registry[storedKey].devices = registry[storedKey].devices.filter(d => d.deviceId !== deviceId);
          if (registry[storedKey].devices.length === 0) {
            delete registry[storedKey];
          }
          saveCentralLicenses(registry);
        }
      }
    }

    localStorage.removeItem('tally_license_key');
    localStorage.removeItem('tally_license_userid');
    
    setLicenseKey('');
    setUserId('');
    setActivationState('unactivated');
    setLicenseDetails(null);
    setActiveView('dashboard');
  };

  // Revoke device remotely
  const revokeDevice = async (targetDeviceId) => {
    const storedKey = localStorage.getItem('tally_license_key');
    if (!storedKey) return;
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/licenses/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: storedKey,
            deviceId: targetDeviceId
          }),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          await checkLicenseStatus();
        }
      } catch (error) {
        console.error("Revoke device server call failed:", error);
      }
    } else {
      const registry = getCentralLicenses();
      if (registry[storedKey]) {
        registry[storedKey].devices = registry[storedKey].devices.filter(d => d.deviceId !== targetDeviceId);
        saveCentralLicenses(registry);
        checkLicenseStatus();
      }
    }
  };

  // Update name of current workstation
  const updateDeviceName = (name) => {
    const cleanName = name.trim() || 'Workstation';
    localStorage.setItem('tally_device_name', cleanName);
    setDeviceName(cleanName);
  };

  // Device switcher for testing limits easily
  const switchSimulatedDevice = (newId, newName) => {
    const cleanId = newId.trim().toUpperCase() || 'DEV-SIM';
    const cleanName = newName.trim() || 'Simulated Laptop';
    localStorage.setItem('tally_device_id', cleanId);
    localStorage.setItem('tally_device_name', cleanName);
    setDeviceId(cleanId);
    setDeviceName(cleanName);
  };

  // Effect to load user-specific data or reset to default when userId changes (login/logout)
  useEffect(() => {
    if (userId !== loadedUserId) {
      if (userId) {
        // Load or migrate ledgers
        const savedLedgers = localStorage.getItem(`tally_${userId}_ledgers`);
        if (savedLedgers) {
          setLedgers(JSON.parse(savedLedgers));
        } else {
          const globalLedgers = localStorage.getItem('tally_ledgers');
          if (globalLedgers) {
            localStorage.setItem(`tally_${userId}_ledgers`, globalLedgers);
            localStorage.removeItem('tally_ledgers');
            setLedgers(JSON.parse(globalLedgers));
          } else {
            setLedgers(DEFAULT_LEDGERS);
          }
        }

        // Load or migrate stock items
        const savedStock = localStorage.getItem(`tally_${userId}_stockItems`);
        if (savedStock) {
          setStockItems(JSON.parse(savedStock));
        } else {
          const globalStock = localStorage.getItem('tally_stockItems');
          if (globalStock) {
            localStorage.setItem(`tally_${userId}_stockItems`, globalStock);
            localStorage.removeItem('tally_stockItems');
            setStockItems(JSON.parse(globalStock));
          } else {
            setStockItems(DEFAULT_STOCK_ITEMS);
          }
        }

        // Load or migrate transactions
        const savedTx = localStorage.getItem(`tally_${userId}_transactions`);
        if (savedTx) {
          setTransactions(JSON.parse(savedTx));
        } else {
          const globalTx = localStorage.getItem('tally_transactions');
          if (globalTx) {
            localStorage.setItem(`tally_${userId}_transactions`, globalTx);
            localStorage.removeItem('tally_transactions');
            setTransactions(JSON.parse(globalTx));
          } else {
            setTransactions(DEFAULT_TRANSACTIONS);
          }
        }

        // Load company details
        const defaultCompany = {
          name: 'Tally Accounting Solutions Ltd.',
          address: '404 Financial Tech Hub, Sector 62, Noida, India',
          gstin: '09AAACT2468A1Z5',
          financialYear: '2026-2027'
        };
        const savedCompany = localStorage.getItem(`tally_${userId}_companyDetails`);
        setCompanyDetails(savedCompany ? JSON.parse(savedCompany) : defaultCompany);
      } else {
        // Reset to default on logout
        setLedgers(DEFAULT_LEDGERS);
        setStockItems(DEFAULT_STOCK_ITEMS);
        setTransactions(DEFAULT_TRANSACTIONS);
        setCompanyDetails({
          name: 'Tally Accounting Solutions Ltd.',
          address: '404 Financial Tech Hub, Sector 62, Noida, India',
          gstin: '09AAACT2468A1Z5',
          financialYear: '2026-2027'
        });
      }
      setLoadedUserId(userId);
    }
  }, [userId, loadedUserId]);

  // Save to LocalStorage whenever state changes, keyed by user ID
  useEffect(() => {
    if (userId && userId === loadedUserId) {
      localStorage.setItem(`tally_${userId}_ledgers`, JSON.stringify(ledgers));
    }
  }, [ledgers, userId, loadedUserId]);

  useEffect(() => {
    if (userId && userId === loadedUserId) {
      localStorage.setItem(`tally_${userId}_stockItems`, JSON.stringify(stockItems));
    }
  }, [stockItems, userId, loadedUserId]);

  useEffect(() => {
    if (userId && userId === loadedUserId) {
      localStorage.setItem(`tally_${userId}_transactions`, JSON.stringify(transactions));
    }
  }, [transactions, userId, loadedUserId]);

  useEffect(() => {
    if (userId && userId === loadedUserId) {
      localStorage.setItem(`tally_${userId}_companyDetails`, JSON.stringify(companyDetails));
    }
  }, [companyDetails, userId, loadedUserId]);

  // Dynamic Voucher Number Generator
  const getNextVoucherNo = (type) => {
    const filtered = transactions.filter((t) => t.voucherType === type);
    const code = type === 'Sales' ? 'SAL' :
                 type === 'Purchase' ? 'PUR' :
                 type === 'Payment' ? 'PMT' :
                 type === 'Receipt' ? 'RCT' : 'JNL';
    const count = filtered.length + 1;
    return `${code}-${String(count).padStart(3, '0')}`;
  };

  // Add ledger
  const addLedger = (ledger) => {
    const newLedger = {
      ...ledger,
      id: `ledger-${Date.now()}`,
      openingBalance: Number(ledger.openingBalance) || 0
    };
    setLedgers((prev) => [...prev, newLedger]);
    return newLedger;
  };

  // Update ledger
  const updateLedger = (id, updatedLedger) => {
    setLedgers((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              ...updatedLedger,
              openingBalance: Number(updatedLedger.openingBalance) || 0
            }
          : l
      )
    );
  };

  // Add stock item
  const addStockItem = (item) => {
    const newItem = {
      ...item,
      id: `stock-${Date.now()}`,
      openingQty: Number(item.openingQty) || 0,
      openingRate: Number(item.openingRate) || 0,
      purchaseRate: Number(item.purchaseRate) || 0,
      saleRate: Number(item.saleRate) || 0,
      gstRate: Number(item.gstRate) || 0
    };
    setStockItems((prev) => [...prev, newItem]);
    return newItem;
  };

  // Update stock item
  const updateStockItem = (id, updatedItem) => {
    setStockItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updatedItem,
              openingQty: Number(updatedItem.openingQty) || 0,
              openingRate: Number(updatedItem.openingRate) || 0,
              purchaseRate: Number(updatedItem.purchaseRate) || Number(updatedItem.openingRate) || 0,
              saleRate: Number(updatedItem.saleRate) || 0,
              gstRate: Number(updatedItem.gstRate) || 0
            }
          : item
      )
    );
  };

  // Add transaction
  const addTransaction = (tx) => {
    const newTx = {
      ...tx,
      id: `tx-${Date.now()}`,
      voucherNo: tx.voucherNo || getNextVoucherNo(tx.voucherType),
      date: tx.date || new Date().toISOString().split('T')[0]
    };
    setTransactions((prev) => [...prev, newTx]);
    return newTx;
  };

  // Delete transaction
  const deleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  // Reset to sample data
  const resetToDefault = () => {
    if (window.confirm('Are you sure you want to reset all accounts and transaction entries to default mock business data?')) {
      setLedgers(DEFAULT_LEDGERS);
      setStockItems(DEFAULT_STOCK_ITEMS);
      setTransactions(DEFAULT_TRANSACTIONS);
      setActiveView('dashboard');
    }
  };

  // Clear all data
  const clearAllData = () => {
    if (window.confirm('WARNING: This will wipe out all data, transactions, ledgers, and stock items. Proceed?')) {
      setLedgers([
        { id: 'ledger-cash', name: 'Cash A/c', subgroup: 'Cash-in-Hand', openingBalance: 0, balanceType: 'Dr' },
        { id: 'ledger-sales', name: 'Sales A/c', subgroup: 'Sales Accounts', openingBalance: 0, balanceType: 'Cr' },
        { id: 'ledger-purchase', name: 'Purchase A/c', subgroup: 'Purchase Accounts', openingBalance: 0, balanceType: 'Dr' }
      ]);
      setStockItems([]);
      setTransactions([]);
      setActiveView('dashboard');
    }
  };

  // Export data to JSON file (full system-wide local storage backup)
  const exportData = () => {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tally_')) {
        backup[key] = localStorage.getItem(key);
      }
    }
    // Also include company details just in case
    backup['tally_company_details_backup'] = JSON.stringify(companyDetails);
    
    const fileData = JSON.stringify(backup, null, 2);
    const blob = new Blob([fileData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_System_Backup_${companyDetails.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file (full system-wide restore)
  const importData = (fileEvent) => {
    const fileReader = new FileReader();
    const file = fileEvent.target.files[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // Check if file contains key-value mappings of tally_ prefixes
        const tallyKeys = Object.keys(parsed).filter(k => k.startsWith('tally_'));
        
        if (tallyKeys.length > 0) {
          // Restore all keys to localStorage
          tallyKeys.forEach(key => {
            localStorage.setItem(key, parsed[key]);
          });
          alert('System backup restored successfully! The page will now reload to apply all data and license states.');
          window.location.reload();
        } else if (parsed.ledgers && parsed.stockItems && parsed.transactions) {
          // Backward compatibility support for pure accounting-only backups
          setLedgers(parsed.ledgers);
          setStockItems(parsed.stockItems);
          setTransactions(parsed.transactions);
          if (parsed.companyDetails) setCompanyDetails(parsed.companyDetails);
          alert('Data imported successfully!');
        } else {
          alert('Invalid backup file structure! Make sure it is a valid Tally backup JSON file.');
        }
      } catch (err) {
        alert('Failed to parse JSON file! ' + err.message);
      }
    };
    fileReader.readAsText(file);
  };

  // --- ADMIN PORTAL ACTIONS ---
  const adminLogin = async (password) => {
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('tally_admin_logged_in', 'true');
          setIsAdminLoggedIn(true);
          return { success: true };
        } else {
          return { success: false, error: data.error || "Incorrect admin password." };
        }
      } catch (error) {
        console.error("Admin login failed on server:", error);
        setServerStatus('disconnected');
        return { success: false, error: "Could not connect to the licensing server. Please check the URL and status." };
      }
    } else {
      if (password === 'admin123') {
        localStorage.setItem('tally_admin_logged_in', 'true');
        setIsAdminLoggedIn(true);
        return { success: true };
      }
      return { success: false, error: "Incorrect admin password." };
    }
  };

  const adminLogout = () => {
    localStorage.removeItem('tally_admin_logged_in');
    setIsAdminLoggedIn(false);
    setActiveView('dashboard');
  };

  const generateAndRegisterKey = async (uId, limit, years) => {
    const cleanUserId = uId.trim();
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/licenses/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: cleanUserId,
            deviceLimit: limit,
            validityYears: years
          }),
          signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await fetchServerLicenses();
          return { success: true, key: data.key };
        } else {
          return { success: false, error: data.error || "Failed to generate key on server." };
        }
      } catch (error) {
        console.error("Failed to generate key on server:", error);
        return { success: false, error: "Server connection failed." };
      }
    } else {
      const existing = generatedLicenses.find(l => l.userId.toLowerCase() === cleanUserId.toLowerCase());
      if (existing) {
        return { success: false, error: `License for User ID '${cleanUserId}' already exists. Please use the 'Renew' option in the Client License Database below to extend its validity.` };
      }

      const key = generateLicenseKey(cleanUserId, limit, years);
      if (!key) {
        return { success: false, error: "Failed to generate license key signature." };
      }

      const newLicense = {
        key,
        userId: cleanUserId,
        deviceLimit: parseInt(limit, 10) || 1,
        validityYears: parseFloat(years) || 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + (parseFloat(years) * 365.25 * 24 * 60 * 60 * 1000)
      };

      setGeneratedLicenses(prev => [newLicense, ...prev]);
      return { success: true, key };
    }
  };

  const renewLicenseKey = async (oldKey, extraYears) => {
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/licenses/renew`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldKey,
            extraYears
          }),
          signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await fetchServerLicenses();
          return { success: true, key: data.key };
        } else {
          return { success: false, error: data.error || "Failed to renew key on server." };
        }
      } catch (error) {
        console.error("Failed to renew key on server:", error);
        return { success: false, error: "Server connection failed." };
      }
    } else {
      const lic = generatedLicenses.find(x => x.key === oldKey);
      if (!lic) {
        return { success: false, error: "License not found in registry database." };
      }

      const years = parseFloat(extraYears) || 1;
      const newKey = generateLicenseKey(lic.userId, lic.deviceLimit, years);
      if (!newKey) {
        return { success: false, error: "Failed to generate renewal key signature." };
      }

      const msInYear = 365.25 * 24 * 60 * 60 * 1000;
      let newExpiresAt;
      if (years > 0) {
        newExpiresAt = Math.max(Date.now(), lic.expiresAt) + (years * msInYear);
      } else {
        newExpiresAt = lic.expiresAt + (years * msInYear);
      }

      const renewedLicense = {
        ...lic,
        key: newKey,
        expiresAt: newExpiresAt,
        validityYears: Math.max(0.1, lic.validityYears + years)
      };

      setGeneratedLicenses(prev => prev.map(x => x.key === oldKey ? renewedLicense : x));

      const registry = getCentralLicenses();
      if (registry[oldKey]) {
        registry[newKey] = {
          ...registry[oldKey],
          expiresAt: newExpiresAt
        };
        delete registry[oldKey];
        saveCentralLicenses(registry);
      }

      return { success: true, key: newKey };
    }
  };

  const globalRevokeDevice = async (key, devId) => {
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/licenses/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            deviceId: devId
          }),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          await fetchServerLicenses();
          await checkLicenseStatus();
        }
      } catch (error) {
        console.error("Failed to revoke device on server:", error);
      }
    } else {
      const registry = getCentralLicenses();
      if (registry[key]) {
        registry[key].devices = registry[key].devices.filter(d => d.deviceId !== devId);
        if (registry[key].devices.length === 0) {
          delete registry[key];
        }
        saveCentralLicenses(registry);
        checkLicenseStatus();
      }
    }
  };

  const globalDeleteLicense = async (key) => {
    if (licensingMode === 'server') {
      try {
        const res = await fetch(`${serverUrl}/api/admin/licenses`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          await fetchServerLicenses();
          await checkLicenseStatus();
        }
      } catch (error) {
        console.error("Failed to delete license on server:", error);
      }
    } else {
      setGeneratedLicenses(prev => prev.filter(x => x.key !== key));
      const registry = getCentralLicenses();
      if (registry[key]) {
        delete registry[key];
        saveCentralLicenses(registry);
      }
      checkLicenseStatus();
    }
  };

  return (
    <TallyContext.Provider
      value={{
        ledgers,
        stockItems,
        transactions,
        companyDetails,
        activeView,
        setActiveView,
        getNextVoucherNo,
        addLedger,
        updateLedger,
        addStockItem,
        updateStockItem,
        addTransaction,
        deleteTransaction,
        resetToDefault,
        clearAllData,
        exportData,
        importData,
        setCompanyDetails,
        // Licensing Variables & Controls
        deviceId,
        deviceName,
        userId,
        licenseKey,
        activationState,
        licenseDetails,
        activateLicense,
        deactivateLicense,
        revokeDevice,
        updateDeviceName,
        switchSimulatedDevice,
        // Server Mode Variables & Operations
        licensingMode,
        setLicensingMode,
        serverUrl,
        setServerUrl,
        serverStatus,
        serverLicenses,
        serverRegistry,
        checkServerConnection,
        fetchServerLicenses,
        // Admin Portal States & Actions
        isAdminLoggedIn,
        generatedLicenses,
        adminLogin,
        adminLogout,
        generateAndRegisterKey,
        globalRevokeDevice,
        globalDeleteLicense,
        renewLicenseKey
      }}
    >
      {children}
    </TallyContext.Provider>
  );
};
