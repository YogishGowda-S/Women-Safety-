// auth.js — Firebase Authentication (Phone OTP + Email)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── REPLACE WITH YOUR FIREBASE CONFIG ──
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

window._safeherAuth = auth;
window._safeherDb   = db;

// ── HELPERS ──
function showMsg(id, text, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `auth-msg ${type}`;
}
function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ""; el.className = "auth-msg"; }
}

// ── AUTH MODAL OPEN/CLOSE ──
const authModal  = document.getElementById("authModal");
const authClose  = document.getElementById("authClose");
const openAuthBtn= document.getElementById("openAuthBtn");
const heroGetStarted = document.getElementById("heroGetStarted");

function openAuth() { authModal.classList.add("active"); document.body.style.overflow = "hidden"; }
function closeAuth(){ authModal.classList.remove("active"); document.body.style.overflow = ""; }

if (openAuthBtn) openAuthBtn.addEventListener("click", openAuth);
if (heroGetStarted) heroGetStarted.addEventListener("click", openAuth);
if (authClose) authClose.addEventListener("click", closeAuth);
authModal?.addEventListener("click", e => { if (e.target === authModal) closeAuth(); });

// ── TABS (Sign In / Register) ──
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".auth-panel").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("panel-" + tab.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// ── METHOD TOGGLE (Phone / Email) per panel ──
document.querySelectorAll(".method-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".auth-panel");
    panel.querySelectorAll(".method-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    panel.querySelectorAll(".method-form").forEach(f => f.classList.remove("active"));
    const panelId = panel.id.replace("panel-", "");
    const formId = `form-${btn.dataset.method}-${panelId}`;
    const form = document.getElementById(formId);
    if (form) form.classList.add("active");
  });
});

// ── RECAPTCHA ──
let recaptchaLoginReady    = false;
let recaptchaRegisterReady = false;

function setupRecaptcha(containerId, key) {
  try {
    const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    window[key] = verifier;
    if (key === "recaptchaLoginVerifier")    recaptchaLoginReady    = true;
    if (key === "recaptchaRegisterVerifier") recaptchaRegisterReady = true;
  } catch(e) { console.warn("reCAPTCHA setup:", e.message); }
}

setupRecaptcha("recaptcha-login",    "recaptchaLoginVerifier");
setupRecaptcha("recaptcha-register", "recaptchaRegisterVerifier");

// ── OTP VARS ──
let loginConfirmResult = null;
let regConfirmResult   = null;

// ── PHONE LOGIN — Send OTP ──
document.getElementById("sendOtpLogin")?.addEventListener("click", async () => {
  clearMsg("loginMsg");
  const phone = "+91" + document.getElementById("loginPhone").value.trim();
  if (phone.length < 13) { showMsg("loginMsg", "Enter a valid 10-digit mobile number."); return; }
  try {
    loginConfirmResult = await signInWithPhoneNumber(auth, phone, window.recaptchaLoginVerifier);
    document.getElementById("otpSectionLogin").classList.remove("hidden");
    showMsg("loginMsg", "OTP sent to " + phone, "success");
  } catch(e) { showMsg("loginMsg", e.message || "Failed to send OTP."); }
});

// ── PHONE LOGIN — Verify OTP ──
document.getElementById("verifyOtpLogin")?.addEventListener("click", async () => {
  const otp = document.getElementById("loginOtp").value.trim();
  if (!otp || otp.length < 6) { showMsg("loginMsg", "Enter the 6-digit OTP."); return; }
  try {
    const result = await loginConfirmResult.confirm(otp);
    await ensureUserProfile(result.user, "");
    showMsg("loginMsg", "Signed in successfully! Redirecting…", "success");
    setTimeout(() => { window.location.href = "app.html"; }, 1200);
  } catch(e) { showMsg("loginMsg", "Invalid OTP. Please try again."); }
});

// ── PHONE REGISTER — Send OTP ──
document.getElementById("sendOtpReg")?.addEventListener("click", async () => {
  clearMsg("registerMsg");
  const phone = "+91" + document.getElementById("regPhone").value.trim();
  if (phone.length < 13) { showMsg("registerMsg", "Enter a valid 10-digit mobile number."); return; }
  try {
    regConfirmResult = await signInWithPhoneNumber(auth, phone, window.recaptchaRegisterVerifier);
    document.getElementById("otpSectionReg").classList.remove("hidden");
    showMsg("registerMsg", "OTP sent to " + phone, "success");
  } catch(e) { showMsg("registerMsg", e.message || "Failed to send OTP."); }
});

// ── PHONE REGISTER — Verify OTP ──
document.getElementById("verifyOtpReg")?.addEventListener("click", async () => {
  const otp  = document.getElementById("regOtp").value.trim();
  const name = document.getElementById("regName").value.trim();
  if (!otp || otp.length < 6) { showMsg("registerMsg", "Enter the 6-digit OTP."); return; }
  try {
    const result = await regConfirmResult.confirm(otp);
    if (name) await updateProfile(result.user, { displayName: name });
    await ensureUserProfile(result.user, name);
    showMsg("registerMsg", "Registered successfully! Redirecting…", "success");
    setTimeout(() => { window.location.href = "app.html"; }, 1200);
  } catch(e) { showMsg("registerMsg", "Invalid OTP. Please try again."); }
});

// ── EMAIL LOGIN ──
document.getElementById("emailLoginBtn")?.addEventListener("click", async () => {
  clearMsg("loginMsg");
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) { showMsg("loginMsg", "Please fill in all fields."); return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMsg("loginMsg", "Signed in! Redirecting…", "success");
    setTimeout(() => { window.location.href = "app.html"; }, 1200);
  } catch(e) {
    const msgs = { "auth/user-not-found": "No account with this email.", "auth/wrong-password": "Incorrect password.", "auth/invalid-email": "Invalid email address." };
    showMsg("loginMsg", msgs[e.code] || e.message);
  }
});

// ── EMAIL REGISTER ──
document.getElementById("emailRegisterBtn")?.addEventListener("click", async () => {
  clearMsg("registerMsg");
  const name     = document.getElementById("regEmailName").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regEmailPassword").value;
  if (!name || !email || !password) { showMsg("registerMsg", "Please fill in all fields."); return; }
  if (password.length < 6) { showMsg("registerMsg", "Password must be at least 6 characters."); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await ensureUserProfile(cred.user, name);
    showMsg("registerMsg", "Account created! Redirecting…", "success");
    setTimeout(() => { window.location.href = "app.html"; }, 1200);
  } catch(e) {
    const msgs = { "auth/email-already-in-use": "An account already exists with this email.", "auth/invalid-email": "Invalid email address.", "auth/weak-password": "Password is too weak." };
    showMsg("registerMsg", msgs[e.code] || e.message);
  }
});

// ── CREATE USER PROFILE IN FIRESTORE ──
async function ensureUserProfile(user, name) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: name || user.displayName || "SafeHer User",
      phone: user.phoneNumber || "",
      email: user.email || "",
      createdAt: new Date().toISOString(),
      isVolunteer: false,
      contacts: [],
      alertCount: 0
    });
  }
}

// ── AUTH STATE: redirect if already logged in ──
onAuthStateChanged(auth, user => {
  if (user && window.location.pathname.includes("index")) {
    window.location.href = "app.html";
  }
});
