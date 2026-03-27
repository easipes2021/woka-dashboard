/**
 * ILLINOIS RIVER DASHBOARD - MASTER SCRIPT
 * Functionality: Weather, River Flow (CFS), Stage (FT), and Water Temp
 */

console.log("App.js: Initializing Master Script...");

// --- 1. GLOBAL VARIABLES ---
// We store these as global so we can destroy/re-create them when data refreshes
let lakeChartInstance = null;
let sskpChartInstance = null;

// --- 2. THE TREND ENGINE ---
/**
 * Compares current vs previous value to return an HTML arrow.
 * Rising (Red), Falling (Green), or Steady (Blue).
 */
function getTrendHTML(current, previous) {
    const diff = current - previous;
    const threshold = current * 0.005; // 0.5% sensitivity
    if (diff > threshold) return '<span class="trend-arrow trend-rising">▲</span>';
    if (diff < -threshold) return '<span class="trend-arrow trend-falling">▼</span>';
    return '<span class="trend-arrow trend-steady">▶</span>';
}

// --- 3. THE MATH ENGINE ---
/**
 * Converts Gage Height (Stage) to Discharge (CFS) for Siloam Springs Kayak Park.
 * Includes a +1.7% adjustment for local sensor variance.
 */
function ratingCurve_CFS(gageHeightFt) {
    const H = parseFloat(gageHeightFt);
    if (isNaN(H) || H <= 0) return 0;
    // Split-coefficient formula for low vs high water accuracy
    return H <= 5.416 ? (21.28 * Math.pow(H, 2.040)) : (2.73 * Math.pow(H, 3.019));
}

// --- 4. UI HELPERS ---
function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Checks if USGS data is older than 2 hours. If so, turns text RED.
 */
function checkDataFreshness(dateTimeStr, elementId) {
    const dataTime = new Date(dateTimeStr);
    const diffInMinutes = (new Date() - dataTime) / (1000 * 60);
    const el = document.getElementById(elementId);
    if (!el) return;

    if (diffInMinutes > 120) {
        el.style.color = "#ff4444";
        el.style.fontWeight = "bold";
        el.textContent = `DELAYED: ${dataTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        el.style.color = "";
        el.style.fontWeight = "normal";
        el.textContent = `Updated: ${getFormattedTime()}`;
    }
}

// --- 5. THE CHARTING ENGINE ---

/**
 * Updates the Lake Francis Stage Chart
 */
function updateLakeChart(chartData) {
    const ctx = document.getElementById('lakeFrancisChart');
    if (!ctx) return;
    
    if (lakeChartInstance) lakeChartInstance.destroy(); // Clear old graph

    lakeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Stage (ft)',
                data: chartData,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'day' }, display: true },
                y: { beginAtZero: false }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(2)} ft`
                    }
                }
            }
        }
    });
}

/**
 * Updates the SSKP Calculated Flow Chart
 */
function updateSiloamChart(chartData) {
    const ctx = document.getElementById('siloamChart');
    if (!ctx) return;

    if (sskpChartInstance) sskpChartInstance.destroy();

    sskpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Flow (CFS)',
                data: chartData,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'day' }, display: true },
                y: { beginAtZero: false }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(0)} CFS`
                    }
                }
            }
        }
    });
}

// --- 6. DATA FETCHERS ---

// Air Temp from Open-Meteo
async function getAirTemperature() {
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        document.getElementById("airTemp").textContent = `${data.current.temperature_2m} °F`;
        document.getElementById("airTempTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (e) { console.error("Temp Error", e); }
}

// Water Temp from Watts, OK
async function loadWaterTempData() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195500&parameterCd=00010";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        const tempF = (parseFloat(latest.value) * 9/5) + 32;
        document.getElementById("waterTempCurrent").textContent = `${tempF.toFixed(1)} °F`;
        checkDataFreshness(latest.dateTime, "waterTempTime");
    } catch (e) { console.error("Water Temp Error", e); }
}

// Lake Francis (7 Day Period for Graphing)
async function loadLakeFrancisData() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const rawValues =
