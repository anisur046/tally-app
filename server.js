import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 80;

app.use(cors());
app.use(express.json());

// Serving built frontend assets
app.use(express.static(path.join(__dirname, 'dist')));

// Database File Path
const DB_FILE = path.join(__dirname, 'tally_server_db.json');

// Helper to load/save database
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = { licenses: [], central_registry: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database file:", error);
    return { licenses: [], central_registry: {} };
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Simple hash and license functions (matching licenseEngine.js)
const SECRET_SALT = "TALLY_ENCRYPTION_SECRET_SALT_2026";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function generateLicenseKey(userId, deviceLimit, validityYears) {
  const payload = {
    userId: userId.trim(),
    deviceLimit: parseInt(deviceLimit, 10) || 1,
    validityYears: parseFloat(validityYears) || 1,
    createdAt: Date.now(),
    nonce: Math.random().toString(36).substring(2, 9)
  };
  const signatureInput = `${payload.userId}|${payload.deviceLimit}|${payload.validityYears}|${payload.createdAt}|${payload.nonce}|${SECRET_SALT}`;
  const signature = simpleHash(signatureInput);
  const licenseObject = { ...payload, signature };
  
  const jsonStr = JSON.stringify(licenseObject);
  const encoded = Buffer.from(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  })).toString('base64');
  
  return `TALLY-${encoded}`;
}

function validateLicenseKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, error: "Key is empty or invalid type." };
  }

  const key = rawKey.trim();
  if (!key.startsWith("TALLY-")) {
    return { valid: false, error: "Invalid key prefix. Keys must start with 'TALLY-'." };
  }

  const base64Part = key.substring(6);

  try {
    const binaryStr = Buffer.from(base64Part, 'base64').toString('binary');
    const jsonStr = decodeURIComponent(binaryStr.split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const licenseObject = JSON.parse(jsonStr);
    const { userId, deviceLimit, validityYears, createdAt, nonce, signature } = licenseObject;

    if (!userId || deviceLimit === undefined || validityYears === undefined || !createdAt || !nonce || !signature) {
      return { valid: false, error: "Corrupted license key structure." };
    }

    const signatureInput = `${userId}|${deviceLimit}|${validityYears}|${createdAt}|${nonce}|${SECRET_SALT}`;
    const expectedSignature = simpleHash(signatureInput);

    if (signature !== expectedSignature) {
      return { valid: false, error: "License key signature check failed. The key is forged or tampered with." };
    }

    const msInYear = 365.25 * 24 * 60 * 60 * 1000;
    const expiresAt = createdAt + (validityYears * msInYear);
    const isExpired = Date.now() > expiresAt;

    return {
      valid: true,
      payload: {
        userId,
        deviceLimit,
        validityYears,
        createdAt,
        expiresAt,
        isExpired
      }
    };
  } catch (err) {
    return { valid: false, error: "Failed to decode license key. Format is invalid." };
  }
}

// --- API ENDPOINTS ---

// Server Connectivity Status Check
app.get('/api/status', (req, res) => {
  res.json({ status: "ok", mode: "server" });
});

// Admin Authentication
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Incorrect admin password." });
  }
});

// Admin: Get all licenses
app.get('/api/admin/licenses', (req, res) => {
  const db = loadDb();
  res.json({ licenses: db.licenses, registry: db.central_registry });
});

// Admin: Generate new key
app.post('/api/admin/licenses/generate', (req, res) => {
  const { userId, deviceLimit, validityYears } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID is required." });
  }

  const db = loadDb();
  const cleanUserId = userId.trim();
  const existing = db.licenses.find(l => l.userId.toLowerCase() === cleanUserId.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: `License for User ID '${cleanUserId}' already exists.` });
  }

  const key = generateLicenseKey(cleanUserId, deviceLimit, validityYears);
  if (!key) {
    return res.status(500).json({ success: false, error: "Failed to generate license key signature." });
  }

  const newLicense = {
    key,
    userId: cleanUserId,
    deviceLimit: parseInt(deviceLimit, 10) || 1,
    validityYears: parseFloat(validityYears) || 1,
    createdAt: Date.now(),
    expiresAt: Date.now() + (parseFloat(validityYears) * 365.25 * 24 * 60 * 60 * 1000)
  };

  db.licenses.unshift(newLicense);
  saveDb(db);

  res.json({ success: true, key });
});

// Admin: Renew / Adjust license validity
app.post('/api/admin/licenses/renew', (req, res) => {
  const { oldKey, extraYears } = req.body;
  const db = loadDb();
  const idx = db.licenses.findIndex(x => x.key === oldKey);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "License not found in registry database." });
  }

  const lic = db.licenses[idx];
  const years = parseFloat(extraYears) || 1;
  const newKey = generateLicenseKey(lic.userId, lic.deviceLimit, years);
  if (!newKey) {
    return res.status(500).json({ success: false, error: "Failed to generate renewal key signature." });
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

  db.licenses[idx] = renewedLicense;

  // Migrate active devices
  if (db.central_registry[oldKey]) {
    db.central_registry[newKey] = {
      ...db.central_registry[oldKey],
      expiresAt: newExpiresAt
    };
    delete db.central_registry[oldKey];
  }

  saveDb(db);
  res.json({ success: true, key: newKey });
});

// Admin & Client: Revoke device remotely
app.post('/api/admin/licenses/revoke', (req, res) => {
  const { key, deviceId } = req.body;
  const db = loadDb();
  
  if (db.central_registry[key]) {
    db.central_registry[key].devices = db.central_registry[key].devices.filter(d => d.deviceId !== deviceId);
    if (db.central_registry[key].devices.length === 0) {
      delete db.central_registry[key];
    }
    saveDb(db);
  }
  
  res.json({ success: true });
});

// Admin: Delete license completely
app.delete('/api/admin/licenses', (req, res) => {
  const { key } = req.body;
  const db = loadDb();
  
  db.licenses = db.licenses.filter(x => x.key !== key);
  if (db.central_registry[key]) {
    delete db.central_registry[key];
  }
  
  saveDb(db);
  res.json({ success: true });
});

// Client: Activate & Verify seat limit
app.post('/api/licenses/activate', (req, res) => {
  const { userId, licenseKey, deviceId, deviceName } = req.body;

  if (!userId || !licenseKey || !deviceId || !deviceName) {
    return res.status(400).json({ success: false, error: "Missing required parameters." });
  }

  const cleanUserId = userId.trim();
  const cleanKey = licenseKey.trim();

  // Validate signature
  const validation = validateLicenseKey(cleanKey);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const { payload } = validation;

  if (cleanUserId.toLowerCase() !== payload.userId.toLowerCase()) {
    return res.status(400).json({
      success: false,
      error: `This key belongs to User: '${payload.userId}'. Casing or spelling does not match.`
    });
  }

  if (Date.now() > payload.expiresAt) {
    return res.status(400).json({ success: false, error: "This license key has expired." });
  }

  // Manage Device Registrations
  const db = loadDb();
  let serverEntry = db.central_registry[cleanKey];

  if (!serverEntry) {
    // Fresh activation for this key
    const initialDevices = [{ deviceId, deviceName, activatedAt: Date.now() }];
    serverEntry = {
      userId: payload.userId,
      deviceLimit: payload.deviceLimit,
      expiresAt: payload.expiresAt,
      devices: initialDevices
    };
    db.central_registry[cleanKey] = serverEntry;
    saveDb(db);

    return res.json({
      success: true,
      payload,
      registeredDevices: initialDevices
    });
  }

  // Key already exists, check if device is registered
  const isRegistered = serverEntry.devices.some(d => d.deviceId === deviceId);

  if (!isRegistered) {
    if (serverEntry.devices.length >= serverEntry.deviceLimit) {
      return res.status(400).json({
        success: false,
        error: `Activation limit reached. Already in use on maximum allowed ${serverEntry.deviceLimit} computer(s).`
      });
    }

    // Add device seat
    const updatedDevices = [...serverEntry.devices, { deviceId, deviceName, activatedAt: Date.now() }];
    serverEntry.devices = updatedDevices;
    db.central_registry[cleanKey] = serverEntry;
    saveDb(db);

    return res.json({
      success: true,
      payload,
      registeredDevices: updatedDevices
    });
  } else {
    // Device already registered, update name if necessary
    let changed = false;
    const updatedDevices = serverEntry.devices.map(d => {
      if (d.deviceId === deviceId && d.deviceName !== deviceName) {
        changed = true;
        return { ...d, deviceName };
      }
      return d;
    });

    if (changed) {
      serverEntry.devices = updatedDevices;
      db.central_registry[cleanKey] = serverEntry;
      saveDb(db);
    }

    return res.json({
      success: true,
      payload,
      registeredDevices: updatedDevices
    });
  }
});

// Client: Deactivate device (logout)
app.post('/api/licenses/deactivate', (req, res) => {
  const { licenseKey, deviceId } = req.body;
  const db = loadDb();

  if (db.central_registry[licenseKey]) {
    db.central_registry[licenseKey].devices = db.central_registry[licenseKey].devices.filter(d => d.deviceId !== deviceId);
    if (db.central_registry[licenseKey].devices.length === 0) {
      delete db.central_registry[licenseKey];
    }
    saveDb(db);
  }

  res.json({ success: true });
});

// Fallback to index.html for Single-Page Routing in frontend
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` TALLY LOCAL SERVER RUNNING`);
  console.log(` Local URL:   http://localhost/`);
  console.log(` Network URL: http://10.179.213.170/`);
  console.log(`====================================================`);
});
