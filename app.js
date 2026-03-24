// -------------------------------------
// Fetch Water Temperature (USACE WTTO2)
// -------------------------------------
async function getWaterTemperature() {
  try {
    const url = "https://www.swt-wc.usace.army.mil/webdata/json/WTTO2.json";
    const res = await fetch(url);
    const data = await res.json();

    // USACE WTTO2 JSON data ends with latest hour entry
    const latest = data.WTTO2[data.WTTO2.length - 1];
    const waterTemp = latest["WTR-TEMP"];

    document.getElementById("waterTemp").textContent =
      waterTemp !== undefined ? `${waterTemp} °F` : "No data available";
  } catch (err) {
    document.getElementById("waterTemp").textContent = "Error loading data";
    console.error(err);
  }
}

// -------------------------------------
// Fetch Air Temperature (OpenWeatherMap)
// -------------------------------------
async function getAirTemperature() {
  const lat = 36.13;
  const lon = -94.57;
  const apiKey = "YOUR_API_KEY"; // <--- Replace this

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const airTemp = data.main.temp;
    document.getElementById("airTemp").textContent = `${airTemp} °F`;
  } catch (err) {
    document.getElementById("airTemp").textContent = "Error loading data";
    console.error(err);
  }
}

// Auto-run both functions on page load
getWaterTemperature();
getAirTemperature();
