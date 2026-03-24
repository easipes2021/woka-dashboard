// -------------------------------------
// Fetch Water Temperature (USACE WTTO2)
// -------------------------------------
// -----------------------------------------------------
// REAL-TIME WATER TEMPERATURE FOR WTTO2 (USACE CSV FEED)
// -----------------------------------------------------
async function getWaterTemperature() {
  try {
    const url = "https://www.swt-wc.usace.army.mil/webdata/gagedata/WTTO2.csv";
    const res = await fetch(url);

    // If fetch fails (CORS or network), throw error
    if (!res.ok) {
      throw new Error("USACE CSV fetch failed");
    }

    const csvText = await res.text();

    // Split CSV into rows
    const lines = csvText.trim().split("\n");

    // First row contains column headers
    const header = lines[0].split(",");



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
getWaterTemperature();
getAirTemperature();
