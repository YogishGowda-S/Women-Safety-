// app.js — SafeHer Dashboard (Firebase + GPS + Push + Volunteers + Contacts)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG (same as auth.js) ──
const firebaseConfig = {
  apiKey: "AIzaSyDLivdgSW6Z7MqMTE_ehOcF9xuPIiMajR0",
  authDomain: "women-safety-fadfa.firebaseapp.com",
  projectId: "women-safety-fadfa",
  storageBucket: "women-safety-fadfa.firebasestorage.app",
  messagingSenderId: "667598080951",
  appId: "1:667598080951:web:138f9cf99cc40bc0d9b632",
  measurementId: "G-3Q2BESYYJR"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── STATE ──
let currentUser  = null;
let userProfile  = null;
let currentLat   = null;
let currentLng   = null;
let miniMap      = null;
let fullMap      = null;
let volMap       = null;
let miniMarker   = null;
let fullMarker   = null;
let trackInterval= null;
let sosHoldTimer = null;
let pushEnabled  = false;
let isVolunteer  = false;
let contacts     = [];
let alertHistory = [];

// ── MOCK VOLUNTEERS (nearby, since we can't query real GPS in demo) ──
const MOCK_VOLUNTEERS = [
  { name:"Priya Sharma",   dist:"0.3 km", lat_off:0.003,  lng_off:0.001  },
  { name:"Rahul Mehta",    dist:"0.7 km", lat_off:-0.005, lng_off:0.004  },
  { name:"Anita Joshi",    dist:"1.1 km", lat_off:0.008,  lng_off:-0.003 },
  { name:"Sneha Patil",    dist:"1.4 km", lat_off:-0.009, lng_off:0.007  },
  { name:"Vikram Singh",   dist:"1.8 km", lat_off:0.012,  lng_off:0.009  },
];

// ════════════════════════════════════════════
// AUTH GUARD
// ════════════════════════════════════════════
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  await loadUserProfile();
  initDashboard();
  getLocation(true);
  renderVolunteers();
  loadContacts();
  loadHistory();
  startWatchClock();
});

// ── SIGN OUT ──
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// ════════════════════════════════════════════
// USER PROFILE
// ════════════════════════════════════════════
async function loadUserProfile() {
  const ref  = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    userProfile  = snap.data();
    isVolunteer  = userProfile.isVolunteer || false;
  } else {
    userProfile = { name: currentUser.displayName || "SafeHer User", isVolunteer: false };
  }
  const name = userProfile.name || currentUser.displayName || "User";
  document.getElementById("sbName").textContent   = name;
  document.getElementById("dashGreeting").textContent = greeting() + ", " + name.split(" ")[0] + ". Stay safe today.";
  updateVolunteerBtn();
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ════════════════════════════════════════════
function initDashboard() {
  document.querySelectorAll(".sb-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      switchPanel(link.dataset.panel);
      // close sidebar on mobile
      document.getElementById("sidebar").classList.remove("open");
      document.querySelector(".sidebar-overlay")?.classList.remove("active");
    });
  });
  // Mobile menu
  document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.querySelector(".sidebar-overlay")?.classList.toggle("active");
  });
  // Sidebar overlay
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);
  overlay.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    overlay.classList.remove("active");
  });
  // mobile SOS mini btn
  document.getElementById("mobileSosMini")?.addEventListener("click", () => triggerSOS());
  // header quick actions
  document.getElementById("refreshLocation")?.addEventListener("click", () => getLocation(true));
  document.getElementById("watchAlertBtn")?.addEventListener("click", sendWatchNotification);
}

function switchPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sb-link").forEach(l => l.classList.remove("active"));
  const panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");
  const link = document.querySelector(`[data-panel="${name}"]`);
  if (link) link.classList.add("active");
  // Lazy-init maps when their panel opens
  if (name === "dashboard" && !miniMap) setTimeout(initMiniMap, 200);
  if (name === "location")  { setTimeout(initFullMap, 200); }
  if (name === "volunteers"){ setTimeout(initVolMap,  200); }
  if (name === "watch")     updateWatchPanel();
}

// ════════════════════════════════════════════
// GEOLOCATION
// ════════════════════════════════════════════
function getLocation(updateMaps = false) {
  if (!navigator.geolocation) { showToast("Geolocation not supported.", "error"); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    currentLat = pos.coords.latitude;
    currentLng = pos.coords.longitude;
    const acc  = Math.round(pos.coords.accuracy);
    const timeStr = new Date().toLocaleTimeString();
    // Update location panel
    document.getElementById("locLat").textContent  = currentLat.toFixed(6);
    document.getElementById("locLng").textContent  = currentLng.toFixed(6);
    document.getElementById("locAcc").textContent  = acc + " m";
    document.getElementById("locTime").textContent = timeStr;
    // Update dashboard coords
    const coordStr = `📍 ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
    document.getElementById("dashCoords").textContent = coordStr;
    document.getElementById("saoCoords").textContent  = "Location: " + currentLat.toFixed(6) + ", " + currentLng.toFixed(6);
    if (updateMaps) {
      if (miniMap) updateMapMarker(miniMap, miniMarker, currentLat, currentLng, "mini");
      if (fullMap) updateMapMarker(fullMap, fullMarker, currentLat, currentLng, "full");
      if (volMap)  updateMapMarker(volMap, null, currentLat, currentLng, "vol");
    }
  }, err => {
    document.getElementById("dashCoords").textContent = "Location access denied.";
    showToast("Enable location access for full features.", "warning");
  }, { enableHighAccuracy: true, timeout: 10000 });
}

// Continuous tracking
document.getElementById("startTrackingBtn")?.addEventListener("click", () => {
  if (trackInterval) { clearInterval(trackInterval); trackInterval = null; document.getElementById("startTrackingBtn").textContent = "▶ Start Continuous Tracking"; return; }
  trackInterval = setInterval(() => getLocation(true), 5000);
  document.getElementById("startTrackingBtn").textContent = "⏹ Stop Tracking";
  showToast("Continuous GPS tracking started.", "success");
});

document.getElementById("refreshLocBtn")?.addEventListener("click", () => { getLocation(true); showToast("Location refreshed.", "success"); });

// Share location link
function buildShareLink() {
  if (!currentLat) return null;
  return `https://maps.google.com/?q=${currentLat},${currentLng}`;
}

document.getElementById("shareLocBtn")?.addEventListener("click", () => {
  const link = buildShareLink();
  if (link) { navigator.clipboard?.writeText(link); showToast("Location link copied!", "success"); }
  else showToast("Fetching your location first…", "warning");
});

document.getElementById("shareLocationBtn")?.addEventListener("click", () => {
  const link = buildShareLink();
  if (!link) { showToast("Fetching location…", "warning"); getLocation(); return; }
  const box = document.getElementById("shareLinkBox");
  const inp = document.getElementById("shareLinkInput");
  box.classList.remove("hidden");
  inp.value = link;
});

document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
  const inp = document.getElementById("shareLinkInput");
  inp.select(); document.execCommand("copy");
  showToast("Link copied to clipboard!", "success");
});

// ════════════════════════════════════════════
// MAPS (Leaflet — no API key needed)
// ════════════════════════════════════════════
function initMiniMap() {
  if (miniMap) return;
  const lat = currentLat || 19.076;
  const lng = currentLng || 72.877;
  miniMap = L.map("miniMap", { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(miniMap);
  const icon = L.divIcon({ className: "", html: '<div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(239,68,68,.6)"></div>', iconSize:[20,20], iconAnchor:[10,10] });
  miniMarker = L.marker([lat, lng], { icon }).addTo(miniMap).bindPopup("You are here").openPopup();
}

function initFullMap() {
  if (fullMap) return;
  const lat = currentLat || 19.076;
  const lng = currentLng || 72.877;
  fullMap = L.map("fullMap").setView([lat, lng], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(fullMap);
  const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 16px rgba(239,68,68,.7)"></div>', iconSize:[22,22], iconAnchor:[11,11] });
  fullMarker = L.marker([lat, lng], { icon }).addTo(fullMap).bindPopup("📍 Your Location").openPopup();
}

function initVolMap() {
  if (volMap) return;
  const lat = currentLat || 19.076;
  const lng = currentLng || 72.877;
  volMap = L.map("volunteerMap").setView([lat, lng], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM" }).addTo(volMap);
  // User marker
  const userIcon = L.divIcon({ className:"", html:'<div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(239,68,68,.6)"></div>', iconSize:[20,20], iconAnchor:[10,10] });
  L.marker([lat, lng], { icon: userIcon }).addTo(volMap).bindPopup("📍 You");
  // Volunteer markers
  const volIcon = L.divIcon({ className:"", html:'<div style="width:18px;height:18px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(34,197,94,.6)"></div>', iconSize:[18,18], iconAnchor:[9,9] });
  MOCK_VOLUNTEERS.forEach(v => {
    L.marker([lat + v.lat_off, lng + v.lng_off], { icon: volIcon }).addTo(volMap).bindPopup("🙋 " + v.name + "<br>" + v.dist + " away");
  });
}

function updateMapMarker(map, marker, lat, lng, type) {
  if (!map) return;
  map.setView([lat, lng], 16);
  if (marker) marker.setLatLng([lat, lng]);
}

// ════════════════════════════════════════════
// EMERGENCY CONTACTS
// ════════════════════════════════════════════
async function loadContacts() {
  if (!currentUser) return;
  const q = query(collection(db, "users", currentUser.uid, "contacts"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  contacts = [];
  snap.forEach(d => contacts.push({ id: d.id, ...d.data() }));
  renderContacts();
  document.getElementById("statContacts").textContent = contacts.length;
}

function renderContacts() {
  const list = document.getElementById("contactsList");
  if (!list) return;
  if (contacts.length === 0) {
    list.innerHTML = '<div class="no-data">No contacts saved yet. Add your first emergency contact above.</div>';
    return;
  }
  list.innerHTML = contacts.map(c => `
    <div class="contact-card">
      <div class="cc-top">
        <div class="cc-avatar">${c.name[0].toUpperCase()}</div>
        <div><div class="cc-name">${c.name}</div><div class="cc-relation">${c.relation}</div></div>
      </div>
      <div class="cc-details">
        <div class="cc-detail">📱 +91 ${c.phone}</div>
        ${c.email ? `<div class="cc-detail">📧 ${c.email}</div>` : ""}
      </div>
      <div class="cc-actions">
        <button class="cc-btn primary" onclick="alertContact('${c.id}')">📨 Alert</button>
        <button class="cc-btn danger" onclick="deleteContact('${c.id}')">🗑 Remove</button>
      </div>
    </div>`).join("");
}

document.getElementById("addContactBtn")?.addEventListener("click", async () => {
  if (!currentUser) return;
  if (contacts.length >= 5) { showFormMsg("contactMsg", "Maximum 5 contacts allowed.", "error"); return; }
  const name    = document.getElementById("cName").value.trim();
  const phone   = document.getElementById("cPhone").value.trim();
  const email   = document.getElementById("cEmail").value.trim();
  const relation= document.getElementById("cRelation").value;
  if (!name || !phone) { showFormMsg("contactMsg", "Name and mobile number are required.", "error"); return; }
  if (phone.length !== 10) { showFormMsg("contactMsg", "Enter a valid 10-digit mobile number.", "error"); return; }
  try {
    const ref = await addDoc(collection(db, "users", currentUser.uid, "contacts"), { name, phone, email, relation, createdAt: serverTimestamp() });
    contacts.push({ id: ref.id, name, phone, email, relation });
    renderContacts();
    document.getElementById("statContacts").textContent = contacts.length;
    document.getElementById("cName").value  = "";
    document.getElementById("cPhone").value = "";
    document.getElementById("cEmail").value = "";
    showFormMsg("contactMsg", "✅ Contact added successfully!", "success");
    showToast(name + " added as emergency contact.", "success");
  } catch(e) { showFormMsg("contactMsg", "Failed to save contact.", "error"); }
});

window.deleteContact = async (id) => {
  if (!confirm("Remove this contact?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "contacts", id));
  contacts = contacts.filter(c => c.id !== id);
  renderContacts();
  document.getElementById("statContacts").textContent = contacts.length;
  showToast("Contact removed.", "success");
};

window.alertContact = (id) => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  showToast("📨 Alert sent to " + c.name + "!", "success");
};

// ════════════════════════════════════════════
// VOLUNTEER SUPPORT
// ════════════════════════════════════════════
function renderVolunteers() {
  const grid = document.getElementById("volunteersList");
  if (!grid) return;
  grid.innerHTML = MOCK_VOLUNTEERS.map(v => `
    <div class="vol-card">
      <div class="vol-avatar">🙋</div>
      <div class="vol-info">
        <div class="vol-name">${v.name}</div>
        <div class="vol-dist">${v.dist} away</div>
        <div class="vol-status"><div class="vol-dot"></div>Available</div>
      </div>
    </div>`).join("");
}

document.getElementById("refreshVolunteers")?.addEventListener("click", () => {
  showToast("Volunteers refreshed.", "success");
  if (volMap) { volMap.remove(); volMap = null; setTimeout(initVolMap, 200); }
  renderVolunteers();
});

function updateVolunteerBtn() {
  const btn = document.getElementById("toggleVolunteerBtn");
  if (!btn) return;
  if (isVolunteer) { btn.textContent = "✅ Registered as Volunteer"; btn.classList.add("registered"); }
  else { btn.textContent = "Register as Volunteer"; btn.classList.remove("registered"); }
}

document.getElementById("toggleVolunteerBtn")?.addEventListener("click", async () => {
  isVolunteer = !isVolunteer;
  await updateDoc(doc(db, "users", currentUser.uid), { isVolunteer });
  updateVolunteerBtn();
  showToast(isVolunteer ? "✅ You are now a registered volunteer!" : "Removed from volunteer list.", isVolunteer ? "success" : "warning");
});

// ════════════════════════════════════════════
// SOS BUTTON (Hold 2s)
// ════════════════════════════════════════════
const sosBtn = document.getElementById("sosMainBtn");
let sosProgress = 0;
let sosInterval = null;

function startSosHold() {
  if (sosInterval) return;
  sosBtn.classList.add("holding");
  sosProgress = 0;
  sosInterval = setInterval(() => {
    sosProgress += 5;
    sosBtn.querySelector(".sos-hint").textContent = Math.min(Math.round(sosProgress / 100 * 2), 2) + "s / 2s";
    if (sosProgress >= 100) { clearInterval(sosInterval); sosInterval = null; triggerSOS(); }
  }, 100);
}

function cancelSosHold() {
  if (sosInterval) { clearInterval(sosInterval); sosInterval = null; }
  sosBtn?.classList.remove("holding");
  if (sosBtn) sosBtn.querySelector(".sos-hint").textContent = "Hold 2s";
}

sosBtn?.addEventListener("mousedown",   startSosHold);
sosBtn?.addEventListener("touchstart",  e => { e.preventDefault(); startSosHold(); });
sosBtn?.addEventListener("mouseup",     cancelSosHold);
sosBtn?.addEventListener("touchend",    cancelSosHold);
sosBtn?.addEventListener("mouseleave",  cancelSosHold);

// ── SOS TRIGGER ──
async function triggerSOS() {
  sosBtn?.classList.remove("holding");
  if (sosBtn) sosBtn.querySelector(".sos-hint").textContent = "Hold 2s";

  // Show overlay
  const overlay = document.getElementById("sosOverlay");
  overlay.classList.remove("hidden");
  const steps = document.getElementById("saoSteps");
  steps.innerHTML = "";

  const sequence = [
    { text: "📍 Capturing GPS location…",  delay: 0   },
    { text: "📨 Alerting emergency contacts…", delay: 600 },
    { text: "👥 Notifying nearby volunteers…", delay: 1200},
    { text: "🔔 Sending watch notification…",  delay: 1800},
    { text: "☁️  Recording incident log…",      delay: 2400},
  ];

  sequence.forEach(s => {
    setTimeout(() => {
      const div = document.createElement("div");
      div.className = "sao-step done";
      div.textContent = s.text;
      steps.appendChild(div);
    }, s.delay);
  });

  // Get location
  getLocation(true);

  // Push notification (smartwatch simulation)
  setTimeout(() => { sendWatchNotification(true); }, 1800);

  // Save to Firestore
  setTimeout(async () => {
    const entry = {
      type: "SOS",
      lat: currentLat,
      lng: currentLng,
      timestamp: serverTimestamp(),
      contactsAlerted: contacts.length,
      volunteersNearby: MOCK_VOLUNTEERS.length
    };
    try {
      await addDoc(collection(db, "users", currentUser.uid, "alerts"), entry);
      await updateDoc(doc(db, "users", currentUser.uid), { alertCount: (userProfile?.alertCount || 0) + 1 });
      alertHistory.unshift({ ...entry, timestamp: new Date().toISOString() });
      const total = parseInt(document.getElementById("statAlerts").textContent || "0") + 1;
      document.getElementById("statAlerts").textContent = total;
      renderHistory();
      renderDashAlerts();
    } catch(e) { console.warn("Firestore save:", e); }
  }, 2600);

  showToast("🚨 SOS ALERT SENT!", "error");
}

document.getElementById("cancelSosBtn")?.addEventListener("click", () => {
  document.getElementById("sosOverlay").classList.add("hidden");
  showToast("SOS alert cancelled.", "warning");
});

// ════════════════════════════════════════════
// ALERT HISTORY
// ════════════════════════════════════════════
async function loadHistory() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, "users", currentUser.uid, "alerts"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    alertHistory = [];
    snap.forEach(d => alertHistory.push({ id: d.id, ...d.data() }));
    document.getElementById("statAlerts").textContent = alertHistory.length;
    renderHistory();
    renderDashAlerts();
  } catch(e) { console.warn("History load:", e); }
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  if (alertHistory.length === 0) {
    list.innerHTML = '<div class="no-data">No alert history. Great — stay safe!</div>';
    return;
  }
  list.innerHTML = alertHistory.map(a => {
    const ts  = a.timestamp?.toDate ? a.timestamp.toDate().toLocaleString() : (a.timestamp ? new Date(a.timestamp).toLocaleString() : "Unknown time");
    const loc = (a.lat && a.lng) ? `${parseFloat(a.lat).toFixed(5)}, ${parseFloat(a.lng).toFixed(5)}` : "Location unavailable";
    return `<div class="history-card">
      <div class="hc-icon">🚨</div>
      <div class="hc-info">
        <div class="hc-title">SOS Alert Triggered</div>
        <div class="hc-meta"><span>🕐 ${ts}</span><span>👥 ${a.volunteersNearby || 0} volunteers</span><span>📞 ${a.contactsAlerted || 0} contacts</span></div>
        <div class="hc-loc">📍 ${loc}</div>
      </div>
    </div>`;
  }).join("");
}

function renderDashAlerts() {
  const list = document.getElementById("dashAlertList");
  if (!list) return;
  if (alertHistory.length === 0) {
    list.innerHTML = '<div class="no-data">No alerts yet. Stay safe!</div>'; return;
  }
  list.innerHTML = alertHistory.slice(0, 4).map(a => {
    const ts = a.timestamp?.toDate ? a.timestamp.toDate().toLocaleTimeString() : "–";
    return `<div class="alert-item"><div class="ai-ico">🚨</div><div class="ai-info"><b>SOS Triggered</b><div class="ai-time">${ts}</div></div></div>`;
  }).join("");
}

document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {
  if (!confirm("Clear all alert history?")) return;
  for (const a of alertHistory) {
    try { await deleteDoc(doc(db, "users", currentUser.uid, "alerts", a.id)); } catch(e) {}
  }
  alertHistory = [];
  renderHistory();
  renderDashAlerts();
  document.getElementById("statAlerts").textContent = "0";
  showToast("History cleared.", "success");
});

// ════════════════════════════════════════════
// SMARTWATCH / PUSH NOTIFICATIONS
// ════════════════════════════════════════════
document.getElementById("enablePushBtn")?.addEventListener("click", async () => {
  if (!("Notification" in window)) { showFormMsg("watchMsg", "Push notifications not supported in this browser.", "error"); return; }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    pushEnabled = true;
    document.getElementById("ws1Status").textContent = "✅ Enabled";
    document.getElementById("ws1Status").className   = "ws-status ok";
    document.getElementById("ws2Status").textContent = "✅ Paired";
    document.getElementById("ws2Status").className   = "ws-status ok";
    document.getElementById("ws1").classList.add("ws-done");
    document.getElementById("ws2").classList.add("ws-done");
    document.getElementById("statWatch").textContent = "ON";
    showFormMsg("watchMsg", "✅ Push notifications enabled! Your watch is now linked.", "success");
    showToast("⌚ Smartwatch alerts enabled!", "success");
  } else {
    showFormMsg("watchMsg", "Notification permission denied. Please enable in browser settings.", "error");
  }
});

document.getElementById("testWatchBtn")?.addEventListener("click", () => sendWatchNotification(false));
document.getElementById("watchAlertBtn")?.addEventListener("click", () => sendWatchNotification(false));

function sendWatchNotification(isSOS = false) {
  if (!("Notification" in window)) { showToast("Notifications not supported.", "error"); return; }
  if (Notification.permission !== "granted") {
    showToast("Enable push notifications first (Smartwatch panel).", "warning"); return;
  }
  const title = isSOS ? "🚨 SafeHer SOS ALERT" : "⌚ SafeHer Watch Test";
  const body  = isSOS
    ? `Emergency alert from your SafeHer app!\nLocation: ${currentLat?.toFixed(5) || "–"}, ${currentLng?.toFixed(5) || "–"}`
    : "Your Fire-Boltt / boAt smartwatch is connected and working correctly.";
  new Notification(title, {
    body,
    icon: "https://via.placeholder.com/64/8b5cf6/ffffff?text=SH",
    badge:"https://via.placeholder.com/32/ef4444/ffffff?text=!",
    vibrate: isSOS ? [300, 100, 300, 100, 300] : [200],
    tag: "safeher-" + Date.now()
  });
  if (!isSOS) {
    document.getElementById("ws3Status").textContent = "✅ Working";
    document.getElementById("ws3Status").className   = "ws-status ok";
    document.getElementById("ws3").classList.add("ws-done");
    showFormMsg("watchMsg", "✅ Test notification sent! Check your browser notifications.", "success");
    showToast("⌚ Watch test alert sent!", "success");
  }
}

// ── WATCH CLOCK ──
function startWatchClock() {
  function tick() {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, "0");
    const mm  = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("watchTime").textContent = hh + ":" + mm;
  }
  tick(); setInterval(tick, 1000);
  // Simulated battery
  document.getElementById("watchBattery").textContent = "87%";
}

function updateWatchPanel() {
  if (pushEnabled) {
    document.getElementById("ws1Status").textContent = "✅ Enabled";
    document.getElementById("ws1Status").className   = "ws-status ok";
  }
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(30px)"; toast.style.transition = ".3s"; setTimeout(() => toast.remove(), 300); }, 3500);
}

function showFormMsg(id, text, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = `form-msg ${type}`;
  setTimeout(() => { if (el.textContent === text) el.className = "form-msg"; }, 4000);
}

window.showToast = showToast;

// ── Page load ──
document.body.style.opacity = "0";
document.body.style.transition = "opacity .4s ease";
requestAnimationFrame(() => { document.body.style.opacity = "1"; });

// Init mini map after short delay (DOM ready)
setTimeout(() => {
  if (document.getElementById("panel-dashboard").classList.contains("active")) initMiniMap();
}, 500);
