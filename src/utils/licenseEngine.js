/**
 * Licensing Utility Engine
 * Handles generation and cryptographic signature validation of license keys.
 */

// Simple hashing function for signature verification (does not require external crypto)
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const SECRET_SALT = "TALLY_ENCRYPTION_SECRET_SALT_2026";

/**
 * Generates a signed license key as a Base64 string
 * @param {string} userId - User Login ID
 * @param {number} deviceLimit - Maximum allowed concurrent devices
 * @param {number} validityYears - Validity of the key in years
 * @returns {string} The encoded license key
 */
export function generateLicenseKey(userId, deviceLimit, validityYears) {
  const payload = {
    userId: userId.trim(),
    deviceLimit: parseInt(deviceLimit, 10) || 1,
    validityYears: parseFloat(validityYears) || 1,
    createdAt: Date.now(),
    nonce: Math.random().toString(36).substring(2, 9)
  };

  // Generate signature
  const signatureInput = `${payload.userId}|${payload.deviceLimit}|${payload.validityYears}|${payload.createdAt}|${payload.nonce}|${SECRET_SALT}`;
  const signature = simpleHash(signatureInput);

  const licenseObject = {
    ...payload,
    signature
  };

  // Convert to Base64 (safely handling unicode)
  try {
    const jsonStr = JSON.stringify(licenseObject);
    const encoded = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return `TALLY-${encoded}`;
  } catch (error) {
    console.error("Key generation failed:", error);
    return "";
  }
}

/**
 * Validates a license key and parses its payload
 * @param {string} rawKey - The raw license key entered by the user
 * @returns {object} { valid: boolean, payload: object, error: string }
 */
export function validateLicenseKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, error: "Key is empty or invalid type." };
  }

  const key = rawKey.trim();
  if (!key.startsWith("TALLY-")) {
    return { valid: false, error: "Invalid key prefix. Keys must start with 'TALLY-'." };
  }

  const base64Part = key.substring(6);

  try {
    // Decode Base64 (safely handling unicode)
    const jsonStr = decodeURIComponent(atob(base64Part).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const licenseObject = JSON.parse(jsonStr);

    const { userId, deviceLimit, validityYears, createdAt, nonce, signature } = licenseObject;

    if (!userId || deviceLimit === undefined || validityYears === undefined || !createdAt || !nonce || !signature) {
      return { valid: false, error: "Corrupted license key structure." };
    }

    // Re-verify signature
    const signatureInput = `${userId}|${deviceLimit}|${validityYears}|${createdAt}|${nonce}|${SECRET_SALT}`;
    const expectedSignature = simpleHash(signatureInput);

    if (signature !== expectedSignature) {
      return { valid: false, error: "License key signature check failed. The key is forged or tampered with." };
    }

    // Calculate expiration timestamp
    // validityYears is float (e.g. 1 year, 0.5 years)
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
  } catch {
    return { valid: false, error: "Failed to decode license key. Format is invalid." };
  }
}
