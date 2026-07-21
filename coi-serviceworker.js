/*! coi-serviceworker v0.1.7 - Guido Zuidhof, MIT License */
let coepCredentialless = false;

if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => {
                    return self.clients.matchAll();
                })
                .then((clients) => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const request =
            r.mode === "no-cors"
                ? new Request(r, {
                    credentials: "omit",
                })
                : r;

        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    const coep = coepCredentialless ? "credentialless" : "require-corp";
                    newHeaders.set("Cross-Origin-Embedder-Policy", coep);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");
        const coepDegrading = (reloadedBySelf == "coep");

        if (window.crossOriginIsolated !== false || coepDegrading) return;

        if (!window.isSecureContext) {
            console.warn("COI Service Worker not registered, a secure context is required.");
            return;
        }

        if (!("serviceWorker" in navigator)) {
            console.error("COI Service Worker not registered, browser does not support service workers.");
            return;
        }

        const n = navigator;
        n.serviceWorker.register(window.document.currentScript.src).then(
            (registration) => {
                console.log("COI Service Worker registered", registration.scope);

                n.serviceWorker.addEventListener("message", (ev) => {
                    if (!ev.data) return;
                    if (ev.data.type === "coepCredentialless") {
                        coepCredentialless = ev.data.value;
                    }
                });

                n.serviceWorker.ready.then((registration) => {
                    registration.active.postMessage({
                        type: "coepCredentialless",
                        value: coepCredentialless,
                    });
                });

                if (registration.active && !n.serviceWorker.controller) {
                    window.sessionStorage.setItem("coiReloadedBySelf", "coi");
                    window.location.reload();
                }
            },
            (err) => {
                console.error("COI Service Worker failed to register:", err);
            }
        );
    })();
}
