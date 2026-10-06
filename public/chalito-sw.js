// Chalito service worker, inside the hub: Web Push with VAPID (D-050) only. Registered by
// PushOptIn (src/components/tools/chalito) with the scope of /app/chalito (or /en/app/chalito),
// so it never controls the rest of the hub. No offline caching: approvals must always be fresh.
//
// Push payloads are metadata only (apps/notifier → @chalito/escalation PushPayload: nid, source,
// counts, notice…), never content. The notification says what kind of thing is waiting; a tap
// opens /n/<nid>, which reads the notification under RLS, acks it and follows its deep link.

const TEXT_URL = "/api/tools/chalito/push-text";
const TEXT_CACHE = "chalito-push-text-v1";
const NID = /^[A-Za-z0-9_-]{1,128}$/; // the same rule as /n/[nid]
/** Used only when the text can't be loaded at all. */
const FALLBACK = { title: "Chalito", body: "", approval: "", expired: "" };

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Best effort: the text is fetched again on a push if this fails.
  event.waitUntil(
    caches
      .open(TEXT_CACHE)
      .then((c) => c.add(TEXT_URL))
      .catch(() => undefined),
  );
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const lang = () => (/^en\b/i.test(self.navigator.language || "") ? "en" : "es");

const loadText = async () => {
  try {
    const cache = await caches.open(TEXT_CACHE);
    let res = await cache.match(TEXT_URL);
    if (!res) {
      res = await fetch(TEXT_URL);
      if (res.ok) await cache.put(TEXT_URL, res.clone());
    }
    const all = await res.json();
    return { ...FALLBACK, ...(all[lang()] || all.es || {}) };
  } catch {
    return FALLBACK;
  }
};

const parse = (event) => {
  try {
    const p = event.data ? event.data.json() : null;
    return p && typeof p.nid === "string" && NID.test(p.nid) ? p : null;
  } catch {
    return null;
  }
};

/** What the notification shows, from metadata alone. */
const notificationFor = (p, text) => {
  const body = p.notice === "approval_expired" ? text.expired : p.source === "approval" ? text.approval : text.body;
  return {
    title: text.title,
    options: {
      body: body || text.body,
      tag: p.nid,
      renotify: true,
      requireInteraction: p.urgency === "high" || p.urgency === "critical",
      icon: "/chalyb-mark.png",
      badge: "/chalyb-mark.png",
      data: { nid: p.nid },
    },
  };
};

self.addEventListener("push", (event) => {
  const p = parse(event);
  if (!p) return;
  event.waitUntil(
    loadText().then((text) => {
      const n = notificationFor(p, text);
      return self.registration.showNotification(n.title, n.options);
    }),
  );
});

/** /app/chalito/n/<nid> in the person's language; it resolves the deep link and acks as "push". */
const targetFor = (nid) => `${lang() === "en" ? "/en" : ""}/app/chalito/n/${encodeURIComponent(nid)}?via=push`;

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const nid = event.notification.data && event.notification.data.nid;
  if (typeof nid !== "string" || !NID.test(nid)) return;
  const url = new URL(targetFor(nid), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => new URL(w.url).origin === self.location.origin && "navigate" in w);
      return same ? same.focus().then((w) => (w || same).navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
