console.log("App.js is running - Stable USGS Version");

// Global chart variables
let lakeChartInstance = null;
let convertedChartInstance = null;

// Helper: Format Time for UI
function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// -------------------------------------
// DARK MODE TOGGLE
// -------------------------------------
const themeToggle = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.textContent = '☀️ Light Mode';
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        initApp(); 
    });
}

// -------------------------------------
// 1. AIR TEMPERATURE
// -------------------------------------
async function getAirTemperature() {
    const tempDisplay = document.getElementById("airTemp");
    const timeDisplay = document.getElementById("airTempTime");
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (data.current) {
            tempDisplay.textContent = `${data.current.temperature_2m} °F`;
            if (timeDisplay) timeDisplay.textContent = `Updated: ${getFormattedTime()}`;
        }
    } catch (err) {
        console.error("Temp error:", err);
    }
}

// -----------------------------------------------------
// 2. LAKE FRANCIS CURRENT
// -----------------------------------------------------
async function loadLakeFrancisCurrent() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        document.getElementById("lakeFrancisCurrent").textContent = latest.value + " ft";
        checkDataFreshness(latest.dateTime, "lakeFrancisTime");
    } catch (err) {
        console.error("Lake Francis Current error:", err);
    }
}

// -----------------------------------------------------
// 3. LAKE FRANCIS GRAPH (7-DAY)
// -----------------------------------------------------
async function loadLakeFrancisGraph() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const values = data.value.timeSeries[0].values[0].value.map(v => ({
            time: v.dateTime,
            height: parseFloat(v.value)
        }));

        const labels = values.map(v => new Date(v.time).toLocaleDateString([], {month:'numeric', day:'numeric'}));
        const heights = values.map(v => v.height);
        
        const ctx = document.getElementById("lakeFrancisChart");
        if (lakeChartInstance) lakeChartInstance.destroy();
        
        lakeChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Gage Height (ft)",
                    data: heights,
                    borderColor: "#0077cc",
                    backgroundColor: "rgba(0, 119, 204, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { autoSkip: true, maxRotation: 0 } },
                    y: { title: { display: true, text: "Feet" } }
                }
            }
        });
        document.getElementById("lakeFrancisGraphTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (err) {
        console.error("Lake Francis Graph error:", err);
    }
}

// -----------------------------------------------------
// 4. SSKP FLOW (Two-Year Analysis Math)
// -----------------------------------------------------
function ratingCurve_CFS(gageHeightFt) {
    const H = parseFloat(gageHeightFt);
    if (isNaN(H) || H <= 0) return 0;
    // Breakpoint: 5.416 ft
    return H <= 5.416 ? (20.93 * Math.pow(H, 2.040)) : (2.68 * Math.pow(H, 3.019));
}

async function updateSiloamCurrentFlow() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065";
    try {
        const resp = await fetch(url, { cache: "no-store" });
        const data = await resp.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        const stage = parseFloat(latest.value);
        const cfs = ratingCurve_CFS(stage);

        document.getElementById("siloamCurrent").textContent = `${cfs.toFixed(1)} CFS`;
        checkDataFreshness(latest.dateTime, "siloamTime");
    } catch (err) {
        console.error("SSKP Current error:", err);
    }
}

// -----------------------------------------------------
// 5. SSKP HISTORIC GRAPH
// -----------------------------------------------------
async function drawConvertedGraph() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&period=P7D";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;

        const labels = [];
        const cfsValues = [];

        rawValues.forEach(v => {
            const flow = ratingCurve_CFS(v.value);
            labels.push(new Date(v.dateTime).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit'}));
            cfsValues.push(flow);
        });

        const ctx = document.getElementById("convertedChart");
        if (convertedChartInstance) convertedChartInstance.destroy();
        
        convertedChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Calculated Flow (CFS)",
                    data: cfsValues,
                    borderColor: "#ffa500",
                    backgroundColor: "rgba(255, 165, 0, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { autoSkip: true, maxTicksLimit: 10 } },
                    y: { title: { display: true, text: "CFS" } }
                }
            }
        });
        document.getElementById("convertedGraphTime").textContent = `Live Calculated: ${getFormattedTime()}`;
    } catch (err) {
        console.error("SSKP Graph error:", err);
    }
}

// -----------------------------------------------------
// FRESHNESS HELPER
// -----------------------------------------------------
function checkDataFreshness(dateTimeStr, elementId) {
    const dataTime = new Date(dateTimeStr);
    const now = new Date();
    const diffInMinutes = (now - dataTime) / (1000 * 60);
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

// -----------------------------------------------------
// INITIALIZER
// -----------------------------------------------------
async function initApp() {
    await Promise.allSettled([
        getAirTemperature(),
        loadLakeFrancisGraph(),
        loadLakeFrancisCurrent(),
        updateSiloamCurrentFlow(),
        drawConvertedGraph()
    ]);
}

// Start immediately
initApp();
// Refresh every 15 mins
setInterval(initApp, 15 * 60 * 1000);
