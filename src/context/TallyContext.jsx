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
  const [ledgers, setLedgers] = useState(() => {
    const saved = localStorage.getItem('tally_ledgers');
    return saved ? JSON.parse(saved) : DEFAULT_LEDGERS;
  });

  const [stockItems, setStockItems] = useState(() => {
    const saved = localStorage.getItem('tally_stockItems');
    return saved ? JSON.parse(saved) : DEFAULT_STOCK_ITEMS;
  });

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('tally_transactions');
    return saved ? JSON.parse(saved) : DEFAULT_TRANSACTIONS;
  });

  const [activeView, setActiveView] = useState('dashboard');
  const [companyDetails, setCompanyDetails] = useState({
    name: 'Tally Accounting Solutions Ltd.',
    address: '404 Financial Tech Hub, Sector 62, Noida, India',
    gstin: '09AAACT2468A1Z5',
    financialYear: '2026-2027'
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

  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('tally_license_userid') || '';
  });

  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem('tally_license_key') || '';
  });

  const [activationState, setActivationState] = useState('unactivated');
  const [licenseDetails, setLicenseDetails] = useState(null);

  // Re-verify the license status
  const checkLicenseStatus = useCallback(() => {
    const storedKey = localStorage.getItem('tally_license_key');
    const storedUserId = localStorage.getItem('tally_license_userid');
    
    if (!storedKey || !storedUserId) {
      setActivationState('unactivated');
      setLicenseDetails(null);
      return;
    }

    // --- AUTO-RENEWAL OVER-THE-AIR SYNC ---
    // If a newer key has been registered/renewed for our User ID by the admin, auto-update local state!
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

    // Check if the user ID matches
    if (storedUserId.trim().toLowerCase() !== payload.userId.toLowerCase()) {
      setActivationState('invalid_key');
      setLicenseDetails(null);
      return;
    }

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      setActivationState('expired');
      setLicenseDetails({
        ...payload,
        registeredDevices: []
      });
      return;
    }

    // Check central server registry for device limits
    const registry = getCentralLicenses();
    const serverEntry = registry[storedKey];

    if (!serverEntry) {
      // Initialize registry entry for this key
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

    // Check if current device is registered under this key
    const isRegistered = serverEntry.devices.some(d => d.deviceId === deviceId);

    if (!isRegistered) {
      if (serverEntry.devices.length < serverEntry.deviceLimit) {
        // Register this device
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
      // Sync/Update device name if changed
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
  }, [deviceId, deviceName]);

  // Run validation on mount & when state changes
  useEffect(() => {
    checkLicenseStatus();
  }, [checkLicenseStatus, licenseKey, userId]);

  // Synchronize across tabs on storage change
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'tally_central_licenses' || e.key === 'tally_license_key' || e.key === 'tally_device_id' || e.key === 'tally_device_name' || e.key === 'tally_generated_licenses') {
        const storedKey = localStorage.getItem('tally_license_key') || '';
        const storedUserId = localStorage.getItem('tally_license_userid') || '';
        const storedDeviceId = localStorage.getItem('tally_device_id');
        const storedDeviceName = localStorage.getItem('tally_device_name');
        
        if (storedDeviceId && storedDeviceId !== deviceId) {
          setDeviceId(storedDeviceId);
        }
        if (storedDeviceName && storedDeviceName !== deviceName) {
          setDeviceName(storedDeviceName);
        }
        setLicenseKey(storedKey);
        setUserId(storedUserId);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deviceId, deviceName]);

  // Activate license function
  const activateLicense = (newUserId, newKey) => {
    const cleanUserId = newUserId.trim();
    const cleanKey = newKey.trim();

    if (!cleanUserId || !cleanKey) {
      return { success: false, error: "Please enter both User ID and License Key." };
    }

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

    // Check device registrations
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

    // Save locally
    localStorage.setItem('tally_license_key', cleanKey);
    localStorage.setItem('tally_license_userid', payload.userId); // Save original casing
    
    setLicenseKey(cleanKey);
    setUserId(payload.userId);

    // Let the useEffect trigger status check
    return { success: true };
  };

  // Deactivate/Logout license function
  const deactivateLicense = () => {
    const storedKey = localStorage.getItem('tally_license_key');
    if (storedKey) {
      const registry = getCentralLicenses();
      if (registry[storedKey]) {
        registry[storedKey].devices = registry[storedKey].devices.filter(d => d.deviceId !== deviceId);
        if (registry[storedKey].devices.length === 0) {
          delete registry[storedKey];
        }
        saveCentralLicenses(registry);
      }
    }

    localStorage.removeItem('tally_license_key');
    localStorage.removeItem('tally_license_userid');
    
    setLicenseKey('');
    setUserId('');
    setActivationState('unactivated');
    setLicenseDetails(null);
  };

  // Revoke device remotely
  const revokeDevice = (targetDeviceId) => {
    const storedKey = localStorage.getItem('tally_license_key');
    if (!storedKey) return;
    const registry = getCentralLicenses();
    if (registry[storedKey]) {
      registry[storedKey].devices = registry[storedKey].devices.filter(d => d.deviceId !== targetDeviceId);
      saveCentralLicenses(registry);
      checkLicenseStatus();
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

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('tally_ledgers', JSON.stringify(ledgers));
  }, [ledgers]);

  useEffect(() => {
    localStorage.setItem('tally_stockItems', JSON.stringify(stockItems));
  }, [stockItems]);

  useEffect(() => {
    localStorage.setItem('tally_transactions', JSON.stringify(transactions));
  }, [transactions]);

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

  // Export data to JSON file
  const exportData = () => {
    const fileData = JSON.stringify({ ledgers, stockItems, transactions, companyDetails }, null, 2);
    const blob = new Blob([fileData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tally_Backup_${companyDetails.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file
  const importData = (fileEvent) => {
    const fileReader = new FileReader();
    const file = fileEvent.target.files[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.ledgers && parsed.stockItems && parsed.transactions) {
          setLedgers(parsed.ledgers);
          setStockItems(parsed.stockItems);
          setTransactions(parsed.transactions);
          if (parsed.companyDetails) setCompanyDetails(parsed.companyDetails);
          alert('Data imported successfully!');
        } else {
          alert('Invalid backup file structure! Make sure it contains ledgers, stockItems, and transactions.');
        }
      } catch (err) {
        alert('Failed to parse JSON file! ' + err.message);
      }
    };
    fileReader.readAsText(file);
  };

  // --- ADMIN PORTAL ACTIONS ---
  const adminLogin = (password) => {
    if (password === 'admin123') {
      localStorage.setItem('tally_admin_logged_in', 'true');
      setIsAdminLoggedIn(true);
      return { success: true };
    }
    return { success: false, error: "Incorrect admin password." };
  };

  const adminLogout = () => {
    localStorage.removeItem('tally_admin_logged_in');
    setIsAdminLoggedIn(false);
  };

  const generateAndRegisterKey = (uId, limit, years) => {
    const cleanUserId = uId.trim();
    // Prevent duplicate active license keys for the same User ID (case-insensitive)
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
  };

  const renewLicenseKey = (oldKey, extraYears) => {
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

    // Update generated licenses list
    setGeneratedLicenses(prev => prev.map(x => x.key === oldKey ? renewedLicense : x));

    // Migrate active registry devices from oldKey to newKey
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
  };

  const globalRevokeDevice = (key, devId) => {
    const registry = getCentralLicenses();
    if (registry[key]) {
      registry[key].devices = registry[key].devices.filter(d => d.deviceId !== devId);
      if (registry[key].devices.length === 0) {
        delete registry[key];
      }
      saveCentralLicenses(registry);
      checkLicenseStatus();
    }
  };

  const globalDeleteLicense = (key) => {
    setGeneratedLicenses(prev => prev.filter(x => x.key !== key));
    const registry = getCentralLicenses();
    if (registry[key]) {
      delete registry[key];
      saveCentralLicenses(registry);
    }
    checkLicenseStatus();
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
        addStockItem,
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
