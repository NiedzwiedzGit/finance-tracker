// Szyfrowanie AES-256-GCM przy użyciu Web Crypto API (wbudowane w przeglądarkę)

const BACKUP_VERSION = "1.0";

// Generuje klucz AES-256 z hasła używając PBKDF2
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Szyfruje dane JSON
export async function encryptBackup(data, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encoded = enc.encode(JSON.stringify({ version: BACKUP_VERSION, data, timestamp: new Date().toISOString() }));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Łączymy salt + iv + zaszyfrowane dane w jeden Base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encrypted), 28);
  return btoa(String.fromCharCode(...combined));
}

// Odszyfrowuje dane
export async function decryptBackup(base64, password) {
  const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);
  const key = await deriveKey(password, salt);
  const dec = new TextDecoder();
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return JSON.parse(dec.decode(decrypted));
}

// Generuje silne hasło
export function generatePassword(length = 20) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const arr = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

// Pobiera datę ostatniego backupu
export function getLastBackupDate() {
  return localStorage.getItem("fin3_last_backup");
}

// Zapisuje datę backupu
export function setLastBackupDate() {
  localStorage.setItem("fin3_last_backup", new Date().toISOString());
}

// Sprawdza czy minął tydzień od ostatniego backupu
export function isBackupDue() {
  const last = getLastBackupDate();
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
}
