console.log("App.js is running");
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

async function loadLakeFrancisGraph() {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";

  try {
    const res = await fetch(url);
    const data = await res.json();

    // Navigate JSON to retrieve time-series data
    const values =
      data.value.timeSeries[0].values[0].value.map((v) => ({
        time: v.dateTime,
        height: parseFloat(v.value),
      }));

    // Create arrays for the chart
    const labels = values.map((v) => new Date(v.time).toLocaleDateString());
    const heights = values.map((v) => v.height);

    // Render Chart
    const ctx = document.getElementById("lakeFrancisChart");

    new Chart(ctx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Gage Height (ft)",
        data: heights,
        borderColor: "#0077cc",
        backgroundColor: "rgba(0, 119, 204, 0.3)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
  responsive: true,
  maintainAspectRatio: false,

  // ✅ Best possible mobile scrubbing
  interaction: {
    mode: "index",
    intersect: false,
  },

  plugins: {
    tooltip: {
      enabled: true,
      displayColors: false,
      bodyFont: { size: 16 },  // ✅ Bigger text on mobile
      titleFont: { size: 14 }
    },
    legend: {
      display: true
    }
  },

  scales: {
    x: {
      title: { display: true, text: "Date" },
      ticks: { autoSkip: true, maxRotation: 0 }
    },
    y: {
      title: { display: true, text: "Feet" }
    }
  }
}

async function loadLakeFrancisCurrent() {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065";

  try {
    const res = await fetch(url);
    const data = await res.json();

    const value =
      data.value.timeSeries[0].values[0].value[0].value;

    document.getElementById("lakeFrancisCurrent").textContent =
      value + " ft";

  } catch (err) {
    console.error("Error loading Lake Francis current level:", err);
    document.getElementById("lakeFrancisCurrent").textContent =
      "Error loading data";
  }
}

loadLakeFrancisCurrent();

// Run it
loadLakeFrancisGraph();

// Auto-run both functions on page load
//getWaterTemperature(); //Disable this for now
getAirTemperature();

