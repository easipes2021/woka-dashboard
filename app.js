/**
 * ILLINOIS RIVER DASHBOARD - MASTER SCRIPT
 * Features: Independent Gauge Loading, Auto-Fahrenheit Conversion, 
 * 7-Day Graphing, and Trend Indicators.
 */

console.log("App.js: Master Script Initializing...");

// --- 1. GLOBAL VARIABLES ---
let lakeChartInstance = null;
let sskpChartInstance = null;

// --- 2. THE TREND ENGINE ---
function getTrendHTML(current, previous) {
    const diff = current - previous;
    const threshold = current * 0.005; // 0.5% sensitivity
    if (diff > threshold) return '<span class="trend-arrow trend-rising">▲</span>';
    if (diff < -threshold) return '<span class="trend-arrow trend-falling">▼</span>';
    return '<span class="trend-arrow trend-steady">▶</span>';
}

// --- 3. THE RATING CURVE (Predictor) ---
function ratingCurve_CFS(gageHeightFt) {
    const H = parseFloat(gageHeightFt);
    if (isNaN(H) || H <= 0) return 0;
    // Formula for Siloam Springs Kayak Park (+1.7% tuned)
    return H <= 5.416 ? (21.28 * Math.pow(H, 2.040)) : (2.73 * Math.pow(H, 3.019));
}

// --- 4. FRESHNESS CHECKER ---
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
        el.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
}

// --- 5. CHARTING FUNCTIONS ---
function updateLakeChart(chartData) {
    const ctx = document.getElementById('lakeFrancisChart');
    if (!ctx) return;
    if (lakeChartInstance) lakeChartInstance.destroy();
    lakeChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: 'Stage (ft)', data: chartData, borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: true, tension: 0.3, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day' } } }, plugins: { legend: { display: false } } }
    });
}

function updateSiloamChart(chartData) {
    const ctx = document.getElementById('siloamChart');
    if (!ctx) return;
    if (sskpChartInstance) sskpChartInstance.destroy();
    sskpChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: 'Flow (CFS)', data: chartData, borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: true, tension: 0.3, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day' } } }, plugins: { legend: { display: false } } }
    });
}

// --- 6. INDEPENDENT FETCHERS ---

// Weather (Open-Meteo)
async function getAirTemperature() {
    try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit");
        const data = await res.json();
        document.getElementById("airTemp").textContent = `${data.current.temperature_2m} °F`;
    } catch (e) { console.error("Air Temp Fail", e); }
}

// Water Temp (Watts, OK)
async function loadWaterTempData() {
    try {
        const res = await fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195500&parameterCd=00010");
        const data = await res.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        const tempF = (parseFloat(latest.value) * 9/5) + 32;
        document.getElementById("waterTempCurrent").textContent = `${tempF.toFixed(1)} °F`;
        checkDataFreshness(latest.dateTime, "waterTempTime");
    } catch (e) { console.error("Water Temp Fail", e); }
}

// Lake Francis (Stage + Graph)
async function loadLakeFrancisData() {
    try {
        const res = await fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D");
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;
        const latest = rawValues[rawValues.length-1];
        const trend = getTrendHTML(parseFloat(latest.value), parseFloat(rawValues[rawValues.length-2].value));
        document.getElementById("lakeFrancisCurrent").innerHTML = `${parseFloat(latest.value).toFixed(2)} ft ${trend}`;
        updateLakeChart(rawValues.map(v => ({ x: new Date(v.dateTime), y: parseFloat(v.value) })));
        checkDataFreshness(latest.dateTime, "lakeFrancisTime");
    } catch (e) { console.error("Lake Fail", e); }
}

// SSKP (Calculated CFS + Graph)
async function loadSSKPData() {
    try {
        const res = await fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&period=P7D");
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;
        const currentCFS = ratingCurve_CFS(rawValues[rawValues.length-1].value);
        const trend = getTrendHTML(currentCFS, ratingCurve_CFS(rawValues[rawValues.length-2].value));
        document.getElementById("siloamCurrent").innerHTML = `${currentCFS.toFixed(1)} CFS ${trend}`;
        updateSiloamChart(rawValues.map(v => ({ x: new Date(v.dateTime), y: ratingCurve_CFS(v.value) })));
        checkDataFreshness(rawValues[rawValues.length-1].dateTime, "siloamTime");
    } catch (e) { console.error("SSKP Fail", e); }
}

// Hwy 16 (CFS)
async function loadHwy16Data() {
    try {
        const res = await fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195400&parameterCd=00060&period=PT2H");
        const data = await res.json();
        const vals = data.value.timeSeries[0].values[0].value;
        const current = parseFloat(vals[vals.length-1].value);
        const trend = getTrendHTML(current, parseFloat(vals[vals.length-2].value));
        document.getElementById("hwy16Current").innerHTML = `${Math.round(current).toLocaleString()} CFS ${trend}`;
        checkDataFreshness(vals[vals.length-1].dateTime, "hwy16Time");
    } catch (e) { console.error("Hwy 16 Fail", e); }
}

// Savoy (CFS)
async function loadSavoyData() {
    try {
        const res = await fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07194800&parameterCd=00060&period=PT2H");
        const data = await res.json();
        const vals = data.value.timeSeries[0].values[0].value;
        const current = parseFloat(vals[vals.length-1].value);
        const trend = getTrendHTML(current, parseFloat(vals[vals.length-2].value));
        document.getElementById("savoyCurrent").innerHTML = `${Math.round(current).toLocaleString()} CFS ${trend}`;
        checkDataFreshness(vals[vals.length-1].dateTime, "savoyTime");
    } catch (e) { console.error("Savoy Fail", e); }
}

// --- 7. THE MASTER INITIALIZER ---
async function initApp() {
    console.log("Fetching all river data...");
    
    // Using Promise.allSettled makes each fetch independent. 
    // If one fails, the others KEEP RUNNING.
    await Promise.allSettled([
        getAirTemperature(),
        loadWaterTempData(),
        loadLakeFrancisData(),
        loadSSKPData(),
        loadHwy16Data(),
        loadSavoyData()
    ]);
    
    console.log("Refresh Cycle Complete.");
}

// Start and set 15-minute timer
initApp();
setInterval(initApp, 15 * 60 * 1000);
