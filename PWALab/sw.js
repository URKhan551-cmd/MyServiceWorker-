console.log("SW: script loaded");

const cacheName = "pwa-cache-v1";

console.log("SW: script loaded");

self.addEventListener("install", (event) => {
    console.log("SW: installing");

    event.waitUntil(
        caches.open(cacheName)
            .then((cache) => {
                console.log("SW: caching files");
                return cache.addAll([
                    "./", 
                    "./index.html",
                    "./style.css",
                    "./app.js"
                ]);
            })
    );
});

self.addEventListener("activate", (event) => {
    console.log("SW: activated");
});
// self.addEventListener("fetch", (event) => {
//     console.log("REQUEST URL:", event.request.url);
//     console.log("REQUEST METHOD:", event.request.method);
//     console.log("REQUEST:", event.request);

//     event.respondWith(
//         new Response("Hello from the service worker")
//     );
// });

self.addEventListener("fetch", (event) => {
    console.log("SW Intercepted:", event.request.url);
    

    event.respondWith(
       caches.match(event.request)
       .then((response) => {
        console.log("CACHE RESULT:", response);
        if(response){
            console.log("CACHE HIT howa:", event.request.url);
            return response;
        }
        
        console.log("CACHE Miss howa:", event.request.url);
        return fetch(event.request);
       })
    );
});
