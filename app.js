console.log("App.js is running");

// Global chart variables to allow refreshing without canvas errors
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
const body = document.body;

if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    if (themeToggle) themeToggle.textContent = '☀️ Light Mode';
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️ Light Mode';
        } else {
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙 Dark Mode';
        }
        initApp(); 
    });
}

// -------------------------------------
// 1. Fetch Air Temperature
// -------------------------------------
async function getAirTemperature() {
    const tempDisplay = document.getElementById("airTemp");
    const timeDisplay = document.getElementById("airTempTime");
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit&_cb=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.current) {
            tempDisplay.textContent = `${data.current.temperature_2m} °F`;
            if (timeDisplay) timeDisplay.textContent = `Updated: ${getFormattedTime()}`;
        }
    } catch (err) {
        console.error("Temp fetch error:", err);
    }
}

// -----------------------------------------------------
// 2. LAKE FRANCIS CURRENT LEVEL
// -----------------------------------------------------
async function loadLakeFrancisCurrent() {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&_cb=${Date.now()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        
        document.getElementById("lakeFrancisCurrent").textContent = latest.value + " ft";
        checkDataFreshness(latest.dateTime, "lakeFrancisTime");
    } catch (err) {
        console.error("Error loading Lake Francis:", err);
    }
}

// -----------------------------------------------------
// 3. LAKE FRANCIS GRAPH (7-DAY)
// -----------------------------------------------------
async function loadLakeFrancisGraph() {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D&_cb=${Date.now()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const values = data.value.timeSeries[0].values[0].value.map((v) => ({
            time: v.dateTime,
            height: parseFloat(v.value),
        }));

        const labels = values.map((v) => new Date(v.time).toLocaleDateString([], {month:'numeric', day:'numeric'}));
        const heights = values.map((v) => v.height);
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
                    backgroundColor: "rgba(0, 119, 204, 0.3)",
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3,
                }],
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

        const scrub = document.getElementById("scrubValue");
        ctx.onmousemove = (event) => {
            const points = lakeChartInstance.getElementsAtEventForMode(event, "index", { intersect: false }, true);
            if (points.length) {
                const i = points[0].index;
                const d = new Date(values[i].time).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
                scrub.textContent = `${d} — ${heights[i]} ft`;
            }
        };
        document.getElementById("lakeFrancisGraphTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (err) {
        console.error("Error loading Lake Francis Graph:", err);
    }
}

// -----------------------------------------------------
// 4. SILOAM SPRINGS CURRENT FLOW (With Fallback)
// -----------------------------------------------------
function ratingCurve_CFS(gageHeightFt) {
    const H = Number(gageHeightFt);
    if (!isFinite(H) || H <= 0) return null;
    return H <= 5.416 ? 20.93 * Math.pow(H, 2.040) : 2.68 * Math.pow(H, 3.019);
}

async function updateSiloamCurrentFlow() {
    const displayEl = document.getElementById("siloamCurrent");
    const timeEl = document.getElementById("siloamTime");
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&_cb=${Date.now()}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const latest = data.value.timeSeries[0].values[0].value[0];
        const stage = parseFloat(latest.value);

        let cfs = ratingCurve_CFS(stage);

        if (cfs !== null) {
            displayEl.textContent = `${cfs.toFixed(1)} CFS`;
            checkDataFreshness(latest.dateTime, "siloamTime");
            localStorage.setItem("siloamLastFlow", cfs.toFixed(1));
            localStorage.setItem("siloamLastTimeFormatted", getFormattedTime());
        }
    } catch (err) {
        console.error("SSKP Flow Update failed:", err);
    }
}

// -----------------------------------------------------
// 5. SSKP HISTORIC CONVERTED GRAPH
// -----------------------------------------------------
async function drawConvertedGraph() {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&period=P7D&_cb=${Date.now()}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;

        const labels = [];
        const cfsValues = [];

        rawValues.forEach(v => {
            const flowCfs = ratingCurve_CFS(parseFloat(v.value));
            labels.push(new Date(v.dateTime).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit'}));
            cfsValues.push(flowCfs);
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
        console.error("Manual flow conversion failed:", err);
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
        el.style.color = "red";
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

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setInterval(initApp, 15 * 60 * 1000);
});
