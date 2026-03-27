console.log("App.js: Initializing Master Script...");

// 1. Global Variables
let lakeChartInstance = null;
let convertedChartInstance = null;

// 2. Rating Curve Math (Tuned +1.7%)
function ratingCurve_CFS(gageHeightFt) {
    const H = parseFloat(gageHeightFt);
    if (isNaN(H) || H <= 0) return 0;
    // High-precision coefficients based on your 2-year analysis + 1.7% shift
    return H <= 5.416 ? (21.28 * Math.pow(H, 2.040)) : (2.73 * Math.pow(H, 3.019));
}

// 3. Helper: Format Time
function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// 4. Helper: Data Freshness (Turns red if > 2hrs old)
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

// 5. The Mobile Chart Builder
function createMobileChart(ctx, labels, dataPoints, labelName, color, chartId, scrubId) {
    return new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: labelName,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color + "33",
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { ticks: { autoSkip: true, maxTicksLimit: 6, maxRotation: 0 } },
                y: { beginAtZero: false }
            },
            onHover: (event, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const val = dataPoints[idx].toFixed(2);
                    const time = labels[idx];
                    const unit = chartId === "lakeFrancisChart" ? "ft" : "CFS";
                    document.getElementById(scrubId).textContent = `${time} — ${val} ${unit}`;
                }
            }
        }
    });
}

// 6. Data Fetchers
async function getAirTemperature() {
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        document.getElementById("airTemp").textContent = `${data.current.temperature_2m} °F`;
        document.getElementById("airTempTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (e) { console.error("Temp Error", e); }
}



async function loadLakeFrancisData() {
    try {
        const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const raw = data.value.timeSeries[0].values[0].value;
        const latest = raw[raw.length - 1];

        document.getElementById("lakeFrancisCurrent").textContent = latest.value + " ft";
        checkDataFreshness(latest.dateTime, "lakeFrancisTime");

        const labels = raw.map(v => new Date(v.dateTime).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}));
        const heights = raw.map(v => parseFloat(v.value));

        if (lakeChartInstance) lakeChartInstance.destroy();
        lakeChartInstance = createMobileChart(document.getElementById("lakeFrancisChart").getContext('2d'), labels, heights, "Stage (ft)", "#0077cc", "lakeFrancisChart", "scrubValue");
        document.getElementById("lakeFrancisGraphTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (e) { console.error("Lake Error", e); }
}

async function loadSSKPData() {
    try {
        const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&period=P7D";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const raw = data.value.timeSeries[0].values[0].value;
        const latest = raw[raw.length - 1];

        const currentFlow = ratingCurve_CFS(latest.value);
        document.getElementById("siloamCurrent").textContent = `${currentFlow.toFixed(1)} CFS`;
        checkDataFreshness(latest.dateTime, "siloamTime");

        const labels = raw.map(v => new Date(v.dateTime).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}));
        const flows = raw.map(v => ratingCurve_CFS(v.value));

        if (convertedChartInstance) convertedChartInstance.destroy();
        convertedChartInstance = createMobileChart(document.getElementById("convertedChart").getContext('2d'), labels, flows, "Flow (CFS)", "#ffa500", "convertedChart", "convertedScrub");
        document.getElementById("convertedGraphTime").textContent = `Updated: ${getFormattedTime()}`;
    } catch (e) { console.error("SSKP Error", e); }
}

// -----------------------------------------------------
// 9. HWY 16 GAUGE (DIRECT CFS) - USGS-07194807
// -----------------------------------------------------
async function loadHwy16Data() {
    // 07194807 is Hwy 16 | 00060 is Discharge (CFS)
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07194807&parameterCd=00060";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        
        // Safety check to ensure USGS is sending data
        if (data.value && data.value.timeSeries[0]) {
            const latest = data.value.timeSeries[0].values[0].value[0];
            const flowValue = parseFloat(latest.value);

            document.getElementById("hwy16Current").textContent = `${Math.round(flowValue).toLocaleString()} CFS`;
            checkDataFreshness(latest.dateTime, "hwy16Time");
        } else {
            document.getElementById("hwy16Current").textContent = "No Data";
        }
    } catch (e) {
        console.error("Hwy 16 Error:", e);
        document.getElementById("hwy16Current").textContent = "Offline";
    }
}

// 7. Initialization
async function initApp() {
    console.log("Starting data fetch...");

    // 1. Safety check: Only update text if the element actually exists
    const s1 = document.getElementById("scrubValue");
    const s2 = document.getElementById("convertedScrub");
    if (s1) s1.textContent = "Loading data...";
    if (s2) s2.textContent = "Loading data...";

    // 2. Run all functions
    // We use await for each to ensure they don't block each other
    try {
        await getAirTemperature();
        await loadLakeFrancisData();
        await loadSSKPData();
        await loadHwy16Data(); // Ensure this function name matches exactly!
    } catch (err) {
        console.error("Initialization error:", err);
    }

    // 3. Reset scrub text
    if (s1) s1.textContent = "Hover/Touch to explore";
    if (s2) s2.textContent = "Hover/Touch to explore";
    
    console.log("Fetch complete.");
}

// Theme Toggle Logic
const themeBtn = document.getElementById('themeToggle');
if (themeBtn) {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
}

// Run immediately
initApp();
setInterval(initApp, 15 * 60 * 1000);
