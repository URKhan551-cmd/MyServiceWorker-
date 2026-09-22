const button = document.querySelector("#loadBtn");
const output = document.querySelector("#output");

button.addEventListener("click", async () => {

    const response = await fetch("./data.json");
    const data = await respose.json();

    output.textContent = JSON.stringify(data, null, 2);
})