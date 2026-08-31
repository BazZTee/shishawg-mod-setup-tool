const crypto = require('crypto');

// Symmetrischer Team-Schlüssel – defense-in-depth.
// Auch wenn jemand den anon-Key hat: ohne diesen Key 
// sind die Supabase-Daten unlesbar.
const ENCRYPTION_KEY = crypto.scryptSync(
  'shishawg-mod-tool-address-key-v1', // Basis-Passphrase
  'shishawg-salt-2026',               // Salt
  32                                  // 256-bit Key
);

const ALGORITHM = 'aes-256-gcm';

/**
 * Verschlüsselt ein Objekt mit den Adressfeldern.
 * Gibt einen Base64-String zurück, der sicher in der DB gespeichert werden kann.
 */
function encryptAddress(addressObj) {
  if (!addressObj || typeof addressObj !== 'object') return null;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const json = JSON.stringify(addressObj);
    const encrypted = Buffer.concat([
      cipher.update(json, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    // Format: iv(16) + authTag(16) + ciphertext → Base64
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  } catch(e) {
    console.error('encryptAddress Fehler:', e.message);
    return null;
  }
}

/**
 * Entschlüsselt einen Base64-String zurück zum Adressobjekt.
 * Gibt null zurück wenn der String kein verschlüsseltes Objekt ist.
 */
function decryptAddress(encryptedBase64) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') return null;
  // Rückwärtskompatibilität: Falls alter Klartext-Eintrag
  if (!isEncrypted(encryptedBase64)) return null;
  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const ciphertext = combined.subarray(32);
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch(e) {
    console.error('decryptAddress Fehler:', e.message);
    return null;
  }
}

/**
 * Prüft heuristisch ob ein String verschlüsselt ist 
 * (Base64 mit korrekter Mindestlänge für iv+authTag+payload).
 */
function isEncrypted(str) {
  if (typeof str !== 'string') return false;
  try {
    const buf = Buffer.from(str, 'base64');
    return buf.length > 32; // mindestens iv(16) + authTag(16) + 1 Byte
  } catch { return false; }
}

module.exports = { encryptAddress, decryptAddress, isEncrypted };
