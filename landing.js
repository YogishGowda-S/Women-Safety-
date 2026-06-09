// landing.js — Landing page interactions (no Firebase)

// ── NAVBAR SCROLL ──
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  navbar?.classList.toggle("scrolled", window.scrollY > 40);
});

// ── MOBILE NAV TOGGLE ──
const navToggle = document.getElementById("navToggle");
const navLinks  = document.getElementById("navLinks");
navToggle?.addEventListener("click", () => {
  navLinks.classList.toggle("open");
  const bars = navToggle.querySelectorAll("span");
  const open = navLinks.classList.contains("open");
  bars[0].style.transform = open ? "rotate(45deg) translate(5px,5px)" : "";
  bars[1].style.opacity   = open ? "0" : "";
  bars[2].style.transform = open ? "rotate(-45deg) translate(5px,-5px)" : "";
});
navLinks?.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.querySelectorAll("span").forEach(s => { s.style.transform = ""; s.style.opacity = ""; });
  });
});

// ── SCROLL REVEAL ──
const reveals = document.querySelectorAll(".reveal");
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const siblings = Array.from(entry.target.parentElement.querySelectorAll(".reveal"));
    entry.target.style.transitionDelay = siblings.indexOf(entry.target) * 0.08 + "s";
    entry.target.classList.add("visible");
    revealObs.unobserve(entry.target);
  });
}, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
reveals.forEach(el => revealObs.observe(el));

// ── SOS DEMO MODAL ──
const sosModal     = document.getElementById("sosModal");
const heroSosDemo  = document.getElementById("heroSosDemo");
const closeSosModal= document.getElementById("closeSosModal");
const previewSos   = document.getElementById("previewSosBtn");

function openSosDemo() {
  sosModal.classList.add("active");
  document.body.style.overflow = "hidden";
  let t = 0;
  const timerEl = document.getElementById("sosTimerVal");
  if (timerEl) {
    timerEl.textContent = "0.0s";
    const iv = setInterval(() => {
      t = +(t + 0.1).toFixed(1);
      timerEl.textContent = t + "s";
      if (t >= 1.2) clearInterval(iv);
    }, 80);
  }
}
heroSosDemo?.addEventListener("click", openSosDemo);
previewSos?.addEventListener("click", openSosDemo);
closeSosModal?.addEventListener("click", () => {
  sosModal.classList.remove("active");
  document.body.style.overflow = "";
});
sosModal?.addEventListener("click", e => {
  if (e.target === sosModal) { sosModal.classList.remove("active"); document.body.style.overflow = ""; }
});

// ── BLOB PARALLAX ──
document.addEventListener("mousemove", e => {
  const x = (e.clientX / innerWidth  - 0.5) * 18;
  const y = (e.clientY / innerHeight - 0.5) * 18;
  const o1 = document.querySelector(".o1");
  const o2 = document.querySelector(".o2");
  if (o1) o1.style.transform = `translate(${x*.4}px,${y*.4}px)`;
  if (o2) o2.style.transform = `translate(${-x*.3}px,${-y*.3}px)`;
});

// ── PAGE FADE IN ──
document.body.style.opacity = "0";
document.body.style.transition = "opacity .4s ease";
requestAnimationFrame(() => { document.body.style.opacity = "1"; });
