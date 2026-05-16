const CACHE_NAME = "finance-backup-v1";
const BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 dni w ms

// Instalacja Service Workera
self.addEventListener("install", (event) => {
  console.log("Service Worker instalowany...");
  self.skipWaiting();
});

// Aktywacja
self.addEventListener("activate", (event) => {
  console.log("Service Worker aktywny");
  event.waitUntil(clients.claim());
});

// Timer — sprawdzenie co godzinę czy czas na backup
self.addEventListener("message", async (event) => {
  if (event.data.type === "START_BACKUP_TIMER") {
    console.log("Timer backupu uruchomiony — sprawdzenie co godzinę");
    setInterval(async () => {
      await checkAndDoBackup();
    }, 60 * 60 * 1000); // Co godzinę
  }
});

// Funkcja do sprawdzenia czy backup się należy
async function checkAndDoBackup() {
  try {
    const lastBackup = await getFromStorage("fin3_last_backup_auto");
    const now = Date.now();
    
    if (!lastBackup || (now - parseInt(lastBackup)) > BACKUP_INTERVAL) {
      console.log("⏰ Czas na automatyczny backup!");
      await doAutoBackup();
    } else {
      const daysLeft = Math.ceil((BACKUP_INTERVAL - (now - parseInt(lastBackup))) / (24 * 60 * 60 * 1000));
      console.log(`Następny backup za ${daysLeft} dni`);
    }
  } catch (error) {
    console.error("Błąd w checkAndDoBackup:", error);
  }
}

// Wykonanie backupu
async function doAutoBackup() {
  try {
    // Pobranie danych z localStorage
    const txData = JSON.parse(localStorage.getItem("fin3_tx") || "{}");
    const recurring = JSON.parse(localStorage.getItem("fin3_recur") || "[]");
    const goals = JSON.parse(localStorage.getItem("fin3_goals") || "[]");
    const password = localStorage.getItem("fin3_backup_pwd");

    if (!password) {
      console.log("⚠️ Brak hasła do backupu — pomijam");
      return;
    }

    const backupData = { txData, recurring, goals, timestamp: new Date().toISOString() };
    
    // Szyfrowanie (używamy Web Crypto API — musi być dostępne)
    const encrypted = await encryptData(JSON.stringify(backupData), password);
    
    // Zapisanie timestampu ostatniego backupu
    await saveToStorage("fin3_last_backup_auto", Date.now().toString());
    
    // Powiadomienie do aplikacji
    const clients_list = await clients.matchAll();
    clients_list.forEach(client => {
      client.postMessage({
        type: "BACKUP_COMPLETED",
        message: "✅ Automatyczny backup wykonany!",
        encrypted,
        filename: `backup-${new Date().toISOString().slice(0,10)}.enc`
      });
    });

    console.log("✅ Automatyczny backup został wykonany i zaszyfrowany");
  } catch (error) {
    console.error("❌ Błąd podczas backupu:", error);
  }
}

// Szyfrowanie AES-256-GCM (taki sam algorytm jak w aplikacji)
async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data)
  );
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(encrypted), 28);
  
  return btoa(String.fromCharCode(...combined));
}

// Pomocnicze — dostęp do storage (Service Worker nie ma localStorage bezpośredniego)
async function getFromStorage(key) {
  const response = await fetch("/api/storage?key=" + key);
  const data = await response.json();
  return data.value;
}

async function saveToStorage(key, value) {
  await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value })
  });
}
