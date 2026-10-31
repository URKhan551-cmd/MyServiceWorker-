# MyServiceWorker-

A hands-on lab for learning **how Service Workers, the Cache API and PWAs work** — built step by step, with every concept written down and covered by automated tests.

![tests](https://img.shields.io/badge/tests-44%20passing-brightgreen) ![node](https://img.shields.io/badge/node-%E2%89%A518-blue) ![dependencies](https://img.shields.io/badge/runtime%20deps-0-lightgrey)

The app itself is deliberately tiny: one page, one button that loads `data.json`, and a service worker that caches the app shell so the page still opens **offline**.

---

## Table of contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Testing](#testing)
- [Known limitations & next steps](#known-limitations--next-steps)
- [Learning notes](#learning-notes)

---

## Quick start

> Service workers only run on **HTTPS** or **`localhost`**, so you must serve the folder — opening `index.html` with `file://` will not work.

```bash
# 1. Install dev dependencies (only needed for the tests)
npm install

# 2. Serve the lab at http://localhost:5500
npm run serve

# 3. Open http://localhost:5500 and check DevTools → Application → Service Workers
```

**Try the offline demo**

1. Load the page once while online (this installs the worker and fills the cache).
2. Reload once more so the page becomes *controlled* by the worker.
3. DevTools → Network → tick **Offline** → reload. The page still opens.

---

## Project structure

```text
MyServiceWorker-/
├── PWALab/                 # the app (what the browser loads)
│   ├── index.html          # page: heading, #loadBtn, #output
│   ├── style.css           # minimal styling
│   ├── app.js              # registers the worker + handles the button
│   ├── sw.js               # the service worker (install / activate / fetch)
│   └── data.json           # sample payload fetched by the button
├── tests/                  # automated tests (Vitest)
│   ├── helpers/
│   │   └── serviceWorkerHarness.js   # runs the real sw.js in a sandbox
│   ├── sw.test.js          # install / activate / fetch behaviour
│   ├── app.test.js         # button + registration behaviour
│   └── static.test.js      # HTML / JSON / cross-file consistency
├── vitest.config.js
├── package.json
└── README.md
```

---

## How it works

```text
Browser ── Request ──▶ Service Worker ── fetch event
                            │
                            ▼
                      Cache Storage
                            │
              ┌─────────────┴─────────────┐
            HIT                          MISS
              │                            │
     return cached Response      fetch(event.request)
                                           │
                                        Network
```

| File | Role |
| --- | --- |
| `app.js` | Feature-detects `"serviceWorker" in navigator`, calls `register("./sw.js")`, and on button click fetches `./data.json` and prints it as formatted JSON. |
| `sw.js` → `install` | Opens the cache `pwa-cache-v1` and precaches `./`, `./index.html`, `./style.css`, `./app.js` using `event.waitUntil(cache.addAll([...]))`. |
| `sw.js` → `activate` | Currently only logs. This is where old caches should be cleaned up (see [next steps](#known-limitations--next-steps)). |
| `sw.js` → `fetch` | **Cache-first**: `caches.match(request)` → return the cached response on a hit, otherwise `fetch(request)` from the network. |

---

## Testing

```bash
npm test            # run everything once
npm run test:watch  # re-run on file changes
```

**Current result: 44 passing, 6 `todo` (50 total, 3 files).**

The service worker is tested by running the **real `sw.js`** inside a Node sandbox with a fake `self`, an in-memory Cache Storage, and a fake network that can be switched offline — so the tests exercise your actual file, not a copy of its logic.

| Suite | Tests | What it proves |
| --- | --- | --- |
| `sw.test.js` | 21 (+4 todo) | Registers the three listeners · opens `pwa-cache-v1` · precaches exactly the 4 shell files · uses `waitUntil` · install **fails** on a 404 or when offline · cache **hit** returns the stored response without touching the network · hits still work **offline** · cache **miss** falls back to the network · network errors reach the page |
| `app.test.js` | 10 (+2 todo) | Output starts empty · click fetches `./data.json` and prints 2-space-indented JSON · works with nested data · second click replaces the first · registers `./sw.js` · logs success · logs (and survives) a failed registration · skips registration when unsupported |
| `static.test.js` | 13 | `index.html` has lang / charset / viewport / title / `#loadBtn` / `#output` · no duplicate ids · every referenced asset exists · `data.json` is valid · every precached path exists on disk · **everything `index.html` needs is precached** · cache name is versioned |

### The tests already caught a real bug

`app.js` originally contained `await respose.json()` (missing the second **n**). The Load button threw a `ReferenceError` on every click, so the app could never display data. The four Load-button tests failed against the original code, and passed after the one-character fix to `response`.

### `todo` tests = the roadmap

Tests marked `todo` describe behaviour the project does **not** have yet. They appear in the test report as reminders and turn into real tests when you build the feature:

- delete old caches on `activate`
- call `clients.claim()` on `activate`
- serve a fallback response when offline and the request is not cached
- precache `./data.json` so the Load button works offline
- show a friendly error in `#output` when `fetch` fails
- show an error when `data.json` responds with a non-OK status

---

## Known limitations & next steps

1. **The Load button does not work offline.** `data.json` is not in the precache list, so the request is a cache miss and the network is down. *Fix:* add `"./data.json"` to `cache.addAll([...])`, then convert the matching `todo` test.
2. **No offline fallback in `fetch`.** On a cache miss while offline, `fetch(event.request)` rejects and the browser shows its error page. *Fix:* add `.catch(() => caches.match("./index.html"))`.
3. **Old caches are never removed.** If you bump `pwa-cache-v1` → `v2`, the v1 cache stays on the user's device forever. *Fix:* in `activate`, delete every cache whose name is not the current one.
4. **First page load is not controlled.** Add `self.skipWaiting()` in `install` and `self.clients.claim()` in `activate` if you want the worker to take over immediately.
5. **Unhandled errors in the click handler.** A failed `fetch` or invalid JSON becomes an unhandled promise rejection. Wrap it in `try/catch` and show a message.
6. **Cleanup:** `sw.js` logs `"SW: script loaded"` twice, and contains a commented-out old `fetch` handler that can be deleted.

---

# Learning notes

Everything below is the original step-by-step write-up of the concepts, kept in the order they were learned.

## Part 1 — Browser & Networking Fundamentals

### 1. What happens when we open a website?

When we visit:

```text
https://example.com
```

A simplified flow is:

```text
URL
 ↓
Browser
 ↓
DNS → IP address
 ↓
TCP connection
 ↓
TLS / HTTPS
 ↓
HTTP request
 ↓
Server
 ↓
HTTP response
 ↓
Browser
```

The browser receives the resources needed by the application:

- HTML
- CSS
- JavaScript
- Images
- Fonts
- JSON

### 2. Client and Server

The browser is usually the **client**.

The machine providing the application/data is the **server**.

```text
Client
  │
  │ HTTP Request
  ▼
Server
  │
  │ HTTP Response
  ▼
Client
```

### 3. HTTP Request

A request tells the server what the browser wants.

Example:

```http
GET /data.json HTTP/1.1
Host: example.com
```

Important parts:

- Method
- URL / path
- Headers
- Body (sometimes)

Common methods:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### 4. HTTP Response

The server sends something back.

Example:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
    "message": "Hello"
}
```

Important parts:

- Status
- Headers
- Body

Common status codes:

| Code | Meaning |
| --- | --- |
| `200` | success |
| `404` | not found |
| `500` | server error |

### 5. JavaScript `fetch()`

When we write:

```js
const response = await fetch("./data.json");
```

JavaScript asks the browser to perform the request.

Simplified:

```text
JavaScript
    │
    │ fetch()
    ▼
Browser networking
    │
    ▼
Server
    │
    ▼
HTTP Response
    │
    ▼
fetch() Promise
```

`fetch()` is asynchronous.

It normally performs a network request; it is not simply reading a file directly from your project folder.

### 6. The Offline Problem

Normally:

```text
App
 ↓
Browser
 ↓
Network
 ↓
Server
```

If the network disappears:

```text
App
 ↓
Browser
 ↓
Network ❌
```

The request fails unless another source is available.

This is one of the problems a PWA can solve.

### 7. Service Worker

A service worker is a browser-managed worker that can participate in handling requests for pages it controls.

Conceptually:

```text
App
 ↓
Browser
 ↓
Service Worker
 ├── Cache
 └── Network
```

The service worker can make decisions such as:

```text
Request
   ↓
Is it cached?
 ├── YES → Cache
 └── NO  → Network
```

### 8. Service Worker ≠ Cache

These are different things.

**Service Worker** — the *logic*. It can decide what to do with requests.

**Cache API** — the *storage mechanism* used to store request/response pairs.

```text
Service Worker
      │
      ├── Cache
      │
      └── Network
```

### 9. Service Worker vs Page JavaScript

Normal page JavaScript:

```js
document.querySelector(...)
```

works with the webpage/DOM.

A service worker does **not** operate as normal DOM JavaScript.

Conceptually:

```text
Browser
 ├── Page JavaScript
 │     └── DOM
 │
 └── Service Worker
       └── Worker APIs
```

### 10. Secure Context

Service workers require a secure context.

Generally:

- `HTTPS` → allowed
- `localhost` → allowed for development

A normal insecure remote HTTP website cannot simply use service workers.

### 11. The PWA Problem We Are Solving

Without a service worker:

```text
fetch()
   ↓
Network
   ↓
Server
```

With a service worker:

```text
fetch()
   ↓
Service Worker
   ├── Cache
   └── Network
```

This gives us the foundation for:

- Offline applications
- Caching strategies
- Network interception
- Installable web applications
- Background capabilities
- Push notifications

## Part 2 — Creating, Registering and the Lifecycle

### 12. Creating a Service Worker

Create:

```text
sw.js
```

Example:

```js
console.log("Service Worker loaded");
```

But simply creating the file does nothing.

The browser needs to be told: *register this file as a Service Worker.*

### 13. Registering the Service Worker

Inside `app.js`:

```js
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
}
```

Flow:

```text
app.js
   │
   │ register("./sw.js")
   ▼
Browser
   │
   ▼
Service Worker Registration
   │
   ▼
sw.js
```

The browser, not our application, manages the Service Worker's lifecycle.

### 14. Feature Detection

We check:

```js
"serviceWorker" in navigator
```

because not every environment necessarily provides the API.

So:

```js
if ("serviceWorker" in navigator) {
    // Service Worker supported
}
```

This prevents our application from assuming the API exists.

### 15. Service Worker Lifecycle

A Service Worker has a lifecycle. Simplified:

```text
Registration
     ↓
Download
     ↓
Install
     ↓
Waiting
     ↓
Activate
     ↓
Active
```

The browser controls this lifecycle. Our code responds to lifecycle events.

### 16. Why `install` and `activate` are separate

They have different responsibilities.

**Install** — think: *"Prepare the new worker."*

```text
Download worker
     ↓
Install
     ↓
Prepare resources
```

**Activate** — think: *"Make the new worker the active version."*

```text
Install complete
     ↓
Activate
     ↓
Worker becomes active
```

This separation becomes extremely important when updating a PWA.

## Part 3 — Fetch Interception & Cache API

### Summary

We moved from simply registering a Service Worker to understanding how it can intercept browser requests and control the responses.

We learned:

- Service Worker lifecycle: install → activate → control
- Why `navigator.serviceWorker.controller` can initially be `null`
- How the `fetch` event intercepts browser requests
- How `event.respondWith()` controls the response
- How `fetch(event.request)` allows the request to continue to the network
- How the Cache API stores `Request → Response`
- Difference between a cache hit and a cache miss
- Why the exact requested URL matters when using `caches.match()`

The final architecture is:

```text
Browser
   │
   │ Request
   ▼
Service Worker
   │
   │ fetch event
   ▼
Cache Storage
   │
   ├── HIT  → return cached Response
   │
   └── MISS → fetch from Network
                    │
                    ▼
                 Response
                    │
                    ▼
                 Browser
```

### Forwarding the Request to the Network

After understanding interception, we changed:

```js
event.respondWith(
    new Response("Hello from the service worker")
);
```

to:

```js
event.respondWith(
    fetch(event.request)
);
```

Now the Service Worker still intercepts the request, but instead of creating its own response, it forwards the request to the network.

```text
Browser
   │
   │ Request
   ▼
Service Worker
   │
   │ fetch(event.request)
   ▼
Network / Server
   │
   │ Response
   ▼
Service Worker
   │
   ▼
Browser
```

An important concept:

> A Service Worker does not have to replace a request. It can inspect, modify, cache, or forward the request.

### Service Worker Lifecycle Discovery

On the first page load:

```text
register()
    ↓
installing
    ↓
installed
    ↓
activated
```

But `navigator.serviceWorker.controller` could initially return `null`.

This happens because registration/activation and page control are separate concepts. After the Service Worker becomes active and the page is subsequently loaded, the page can become controlled:

```text
Service Worker
      ↓
   activated
      ↓
controls page
      ↓
fetch events
```

This taught us:

> **Registered, activated, and controlling the current page are not the same thing.**

### Cache API

#### Create a cache

We created a cache during the installation phase:

```js
const CACHE_NAME = "pwa-cache-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
    );
});
```

`caches.open("pwa-cache-v1")` opens an existing cache or creates it if it doesn't exist.

Think of the cache conceptually as:

```text
Cache
┌──────────────────────────┐
│ Request → Response       │
│ Request → Response       │
│ Request → Response       │
└──────────────────────────┘
```

#### Why `event.waitUntil()`?

Service Worker installation involves asynchronous operations. For example:

```js
event.waitUntil(
    caches.open(CACHE_NAME)
);
```

means: *keep the installation alive until this Promise finishes.*

```text
install
   │
   ▼
async cache operation
   │
   ▼
Promise resolves
   │
   ▼
installation completes
```

Without `waitUntil()`, the browser is not explicitly told that the installation depends on that asynchronous operation.

#### Cache `index.html`

We then stored a file:

```js
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log("SW: caching index.html");

                return cache.add("./index.html");
            })
    );
});
```

The flow is:

```text
Service Worker installing
        ↓
Open pwa-cache-v1
        ↓
Request index.html
        ↓
Receive Response
        ↓
Store Response in Cache
```

We verified this through DevTools → Application → Cache Storage → `pwa-cache-v1` → `index.html`.

#### Cache multiple files

We then expanded the cache:

```js
const CACHE_NAME = "pwa-cache-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll([
                    "./",
                    "./index.html",
                    "./style.css",
                    "./app.js"
                ]);
            })
    );
});
```

Now the cache can contain:

```text
pwa-cache-v1
├── /
├── index.html
├── style.css
└── app.js
```

#### Cache lookup

We then connected Cache Storage to the `fetch` event:

```js
self.addEventListener("fetch", (event) => {
    console.log("SW Intercepted:", event.request.url);

    event.respondWith(
        caches.match(event.request)
            .then((response) => {

                console.log("CACHE RESULT:", response);

                if (response) {
                    console.log("CACHE HIT:", event.request.url);

                    return response;
                }

                console.log("CACHE MISS:", event.request.url);

                return fetch(event.request);
            })
    );
});
```

**Cache HIT** — suppose the browser requests `/style.css` and it exists in Cache Storage. Then `caches.match(event.request)` returns the cached `Response`:

```text
Browser
   │
   │ GET /style.css
   ▼
Service Worker
   │
   ▼
caches.match()
   │
   ▼
Found Response
   │
   ▼
CACHE HIT
   │
   ▼
Return cached Response
   │
   ▼
Browser
```

Console:

```text
SW Intercepted: .../style.css
CACHE RESULT: Response {...}
CACHE HIT: .../style.css
```

**Cache MISS** — if the browser requests `/app.js` but it is not in the cache, `caches.match(event.request)` returns `undefined`. The Service Worker then performs `fetch(event.request)`:

```text
Browser
   │
   │ GET /app.js
   ▼
Service Worker
   │
   ▼
caches.match()
   │
   ▼
undefined
   │
   ▼
CACHE MISS
   │
   ▼
fetch(event.request)
   │
   ▼
Network
   │
   ▼
Response
   │
   ▼
Browser
```

Console:

```text
SW Intercepted: .../app.js
CACHE RESULT: undefined
CACHE MISS: .../app.js
```

### Core concepts learned

1. **Service Worker** — a background browser context that can intercept and respond to network-related requests within its scope.
2. **`install`** — used for setup work such as creating/opening caches and pre-caching important application resources.
3. **`activate`** — runs when the Service Worker becomes active.
4. **`fetch`** — runs when a controlled page makes a request that the Service Worker can intercept.
5. **`event.respondWith()`** — tells the browser: *"I will provide the response for this request."*
6. **`event.waitUntil()`** — tells the browser: *"This lifecycle operation depends on this asynchronous work finishing."*
7. **Cache API** — stores request/response pairs that a Service Worker can retrieve later.
8. **Cache hit** — `Request → Cache → Response found`.
9. **Cache miss** — `Request → Cache → Nothing found → Network`.