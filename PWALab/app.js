const button = document.querySelector("#loadBtn");
const output = document.querySelector("#output");

button.addEventListener("click", async () => {

    const response = await fetch("./data.json");
    const data = await respose.json();

    output.textContent = JSON.stringify(data, null, 2);
})

if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js")  // our first step towards pwa
    .then((registration) => {                    // promise 
        console.log("SerWkr registered:", registration);
        console.log("Controller:", navigator.serviceWorker.controller); // service worker becomes the one who lead. not browser
    })
    .catch((error) => {
        console.error("SW registration failed:", error);
    });
}

