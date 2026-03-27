console.log("App.js is running");

// Global chart variables to allow refreshing without canvas errors
let lakeChartInstance = null;
let convertedChartInstance = null;

// Helper: Format Time for UI
function getFormattedTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/ -------------------------------------
// DARK MODE TOGGLE
// -------------------------------------
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Check for saved user preference on load
if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    themeToggle.textContent = '☀️ Light Mode';
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☀️ Light Mode';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '🌙 Dark Mode';
    }
});



// -------------------------------------
// 1. Fetch Air Temperature
// -------------------------------------
async function getAirTemperature() {
  const tempDisplay = document.getElementById("airTemp");
  const timeDisplay = document.getElementById("airTempTime"); // Matches HTML exactly

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.current) {
      // Update the Temperature
      tempDisplay.textContent = `${data.current.temperature_2m} °F`;
      
      // Update the Timestamp
      if (timeDisplay) {
        const now = getFormattedTime();
        timeDisplay.textContent = `Updated: ${now}`;
        console.log("Air Temp Timestamp Updated to:", now); // Debugging line
      } else {
        console.error("Could not find element with ID 'airTempTime'");
      }
    }
  } catch (err) {
    console.error("Temp fetch error:", err);
    tempDisplay.textContent = "Error";
    if (timeDisplay) timeDisplay.textContent = "Check Connection";
  }
}

// -----------------------------------------------------
// 2. LAKE FRANCIS CURRENT LEVEL
// -----------------------------------------------------
async function loadLakeFrancisCurrent() {
  const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065";
  try {
    const res = await fetch(url);
    const data = await res.json();
    const value = data.value.timeSeries[0].values[0].value[0].value;

    document.getElementById("lakeFrancisCurrent").textContent = value + " ft";
    document.getElementById("lakeFrancisTime").textContent = `Updated: ${getFormattedTime()}`;
  } catch (err) {
    console.error("Error loading Lake Francis current level:", err);
    document.getElementById("lakeFrancisCurrent").textContent = "Error";
  }
}

// -----------------------------------------------------
// 3. LAKE FRANCIS GRAPH (7-DAY)
// -----------------------------------------------------
async function loadLakeFrancisGraph() {
  const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";
  try {
    const res = await fetch(url);
    const data = await res.json();

    const values = data.value.timeSeries[0].values[0].value.map((v) => ({
      time: v.dateTime,
      height: parseFloat(v.value),
    }));

    const labels = values.map((v) => new Date(v.time).toLocaleDateString());
    const heights = values.map((v) => v.height);
    const ctx = document.getElementById("lakeFrancisChart");

    // Destroy existing chart if it exists (for auto-refresh)
    if (lakeChartInstance) lakeChartInstance.destroy();

    lakeChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Gage Height (ft)",
          data: heights,
          borderColor: "#0077cc",
          backgroundColor: "rgba(0, 119, 204, 0.3)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          tooltip: { enabled: true, displayColors: false },
          legend: { display: true }
        },
        scales: {
          x: { ticks: { autoSkip: true, maxRotation: 0 } },
          y: { title: { display: true, text: "Feet" } }
        }
      }
    });

    const scrub = document.getElementById("scrubValue");
    function updateReadout(event) {
      const points = lakeChartInstance.getElementsAtEventForMode(event, "index", { intersect: false }, true);
      if (points.length) {
        const i = points[0].index;
        scrub.textContent = `${labels[i]} — ${heights[i]} ft`;
      }
    }
    ctx.addEventListener("mousemove", updateReadout);
    ctx.addEventListener("touchmove", updateReadout);

    document.getElementById("lakeFrancisGraphTime").textContent = `Updated: ${getFormattedTime()}`;
  } catch (err) {
    console.error("Error loading Lake Francis Graph:", err);
  }
}

// -----------------------------------------------------
// 4. SILOAM SPRINGS CURRENT FLOW (With Cache & Fallback)
// -----------------------------------------------------
function ratingCurve_CFS(gageHeightFt) {
  const H = Number(gageHeightFt);
  if (!isFinite(H) || H <= 0) return null;
  const H_break = 5.416;
  if (H <= H_break) return 20.93 * Math.pow(H, 2.040);
  return 2.68 * Math.pow(H, 3.019);
}

async function getSiloamStage() {
  const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065";
  const resp = await fetch(url);
  const data = await resp.json();
  return parseFloat(data.value.timeSeries[0].values[0].value[0].value);
}

async function getLiveCFS(stageFt) {
  const url = `https://woka-rating-api.onrender.com/flow?stage=${stageFt}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("API not responding");
  const data = await resp.json();
  return data.discharge_cfs;
}

async function updateSiloamCurrentFlow() {
  const displayEl = document.getElementById("siloamCurrent");
  const timeEl = document.getElementById("siloamTime");
  
  // Load from cache to show immediately
  const cachedFlow = localStorage.getItem("siloamLastFlow");
  const cachedTime = localStorage.getItem("siloamLastTimeFormatted");
  
  if (cachedFlow) {
    displayEl.innerHTML = `${cachedFlow} CFS <br><span class="refreshing-text">(Refreshing...)</span>`;
    timeEl.textContent = `Last seen: ${cachedTime}`;
  } else {
    displayEl.innerHTML = '<div class="spinner"></div> <br><span class="refreshing-text" style="color:var(--text-muted);">Waking up server...</span>';
  }

  try {
    const stage = await getSiloamStage();
    let cfs;

    try {
      cfs = await getLiveCFS(stage); // Try external API
    } catch (apiErr) {
      console.warn("Render API failed/sleeping. Falling back to local math.");
      cfs = ratingCurve_CFS(stage); // Fallback to local formula
    }

    if (cfs !== null) {
      const timeNow = getFormattedTime();
      const formattedCFS = cfs.toFixed(1);
      
      displayEl.textContent = `${formattedCFS} CFS`;
      timeEl.textContent = `Updated: ${timeNow}`;
      
      localStorage.setItem("siloamLastFlow", formattedCFS);
      localStorage.setItem("siloamLastTimeFormatted", timeNow);
    }
  } catch (err) {
    console.error("SSKP Flow Update failed:", err);
    if (cachedFlow) {
      displayEl.innerHTML = `${cachedFlow} CFS <br><span class="refreshing-text" style="color:red;">(Offline)</span>`;
    } else {
      displayEl.textContent = "Data Unavailable";
    }
  }
}

// -----------------------------------------------------
// 5. SSKP HISTORIC CONVERTED GRAPH
// -----------------------------------------------------
async function drawConvertedGraph() {
  try {
    const resp = await fetch("https://woka-rating-api.onrender.com/historic-converted");
    if (!resp.ok) throw new Error("Render API offline");
    const points = await resp.json();

    const labels = points.map(p => new Date(p.timestamp).toLocaleString());
    const cfsValues = points.map(p => p.converted_cfs);
    const ctx = document.getElementById("convertedChart");

    // Destroy existing chart if it exists (for auto-refresh)
    if (convertedChartInstance) convertedChartInstance.destroy();

    convertedChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Converted Flow (CFS)",
          data: cfsValues,
          borderColor: "#0077cc",
          backgroundColor: "rgba(0, 119, 204, 0.3)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          tooltip: { enabled: true, displayColors: false },
          legend: { display: true }
        },
        scales: {
          x: { ticks: { autoSkip: true, maxRotation: 0 } },
          y: { title: { display: true, text: "CFS" } }
        }
      }
    });

    const scrub = document.getElementById("convertedScrub");
    function updateReadout(event) {
      const pointsAtEvent = convertedChartInstance.getElementsAtEventForMode(event, "index", { intersect: false }, true);
      if (pointsAtEvent.length) {
        const i = pointsAtEvent[0].index;
        scrub.textContent = `${labels[i]} — ${cfsValues[i].toFixed(0)} CFS`;
      }
    }
    ctx.addEventListener("mousemove", updateReadout);
    ctx.addEventListener("touchmove", updateReadout);

    document.getElementById("convertedGraphTime").textContent = `Updated: ${getFormattedTime()}`;
  } catch (err) {
    console.error("Historic flow failed to load (API might be asleep).", err);
    document.getElementById("convertedGraphTime").textContent = "Data load failed.";
  }
}

// -----------------------------------------------------
// APPLICATION INITIALIZER & AUTO-REFRESH
// -----------------------------------------------------
async function initApp() {
  console.log("Fetching latest hydrology data...");
  await Promise.allSettled([
    getAirTemperature(),
    loadLakeFrancisGraph(),
    loadLakeFrancisCurrent(),
    updateSiloamCurrentFlow(),
    drawConvertedGraph()
  ]);
  console.log("Dashboard updated successfully.");
}

// 1. Fire immediately on page load
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  
  // 2. Auto-refresh every 15 minutes (900,000 milliseconds)
  setInterval(initApp, 15 * 60 * 1000);
});
