// -------------------------------------
// Fetch Water Temperature (USACE WTTO2)
// -------------------------------------
// -----------------------------------------------------
// REAL-TIME WATER TEMPERATURE FOR WTTO2 (USACE CSV FEED)
// -----------------------------------------------------
async function getWaterTemperature() {
  const display = document.getElementById("waterTemp");

  const proxyUrl = "https://api.allorigins.win/get?url=" +
    encodeURIComponent("https://www.swt-wc.usace.army.mil/webdata/gagedata/WTTO2.current.html");

  try {
    const res = await fetch(proxyUrl);

    if (!res.ok) {
      throw new Error("Proxy fetch failed");
    }

    const data = await res.json();
    const html = data.contents;

    // Extract WTR-TEMP using regex
    const tempMatch = html.match(/WTR-TEMP.*?([\d.]+)/);

    if (!tempMatch) {
      console.error("Temperature not found in HTML");
      display.textContent = "No data available";
      return;
    }

    const waterTemp = tempMatch[1];
    display.textContent = `${waterTemp} °F`;

  } catch (err) {
    console.error("WTTO2 fetch error:", err);
    display.textContent = "Error loading data";
  }
}



// -------------------------------------
// Fetch Air Temperature (OpenWeatherMap)
// -------------------------------------
async function getAirTemperature() {
  const lat = 36.13;
  const lon = -94.57;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.current || data.current.temperature_2m === undefined) {
      document.getElementById("airTemp").textContent = "No data available";
      console.error("Open-Meteo missing field:", data);
      return;
    }

    const temp = data.current.temperature_2m;
    document.getElementById("airTemp").textContent = `${temp} °C`;
  } catch (err) {
    document.getElementById("airTemp").textContent = "Error loading data";
    console.error("Open-Meteo fetch error:", err);
  }
}
``

// Auto-run both functions on page load
//getWaterTemperature(); //Disable this for now
getAirTemperature();
