// firebase-messaging-sw.js
// Service Worker for background push notifications

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || "SafeHer Alert";
  const options = {
    body:    data.body    || "You have a new SafeHer notification.",
    icon:    data.icon    || "/icon.png",
    badge:   data.badge   || "/icon.png",
    vibrate: data.vibrate || [200, 100, 200],
    data:    { url: data.url || "/app.html" },
    actions: [
      { action: "open",    title: "Open App" },
      { action: "dismiss", title: "Dismiss"  }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "open" || !event.action) {
    const url = event.notification.data?.url || "/app.html";
    event.waitUntil(clients.openWindow(url));
  }
});

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e  => e.waitUntil(clients.claim()));
