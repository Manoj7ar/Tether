/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: PushPayload;
  try {
    data = event.data.json() as PushPayload;
  } catch {
    data = { title: "Tether", body: event.data.text() };
  }

  const title = data.title || "Tether — Approval Required";
  const options: NotificationOptions = {
    body: data.body || "A mission needs your approval.",
    icon: data.icon || "/favicon.svg",
    badge: data.badge || "/favicon.svg",
    tag: data.url || "/approve",
    data: { url: data.url || "/approve" },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url || "/approve";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).pathname.startsWith("/approve") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
