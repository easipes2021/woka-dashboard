console.log("App.js: Initializing Master Script...");

//Assists in rising/falling arrows
function getTrendHTML(current, previous) {
    const diff = current - previous;
    // Threshold of 0.5% to avoid "flickering" arrows on tiny sensor noise
    const threshold = current * 0.005; 

    if (diff > threshold) {
        return '<span class="trend-arrow trend-rising">▲</span>';
    } else if (diff < -threshold) {
        return '<span class="trend-arrow trend-falling">▼</span>';
    } else {
        return '<span class="trend-arrow trend-steady">▶</span>';
    }
}

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

async function loadWaterTempData() {
    // 07195500 = Watts | 00010 = Water Temp (C)
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195500&parameterCd=00010";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        
        if (data.value && data.value.timeSeries[0] && data.value.timeSeries[0].values[0].value.length > 0) {
            const latest = data.value.timeSeries[0].values[0].value[0];
            
            // Convert C to F: (C * 9/5) + 32
            const tempC = parseFloat(latest.value);
            const tempF = (tempC * 9/5) + 32;

            // Display just the temperature with no arrow
            document.getElementById("waterTempCurrent").textContent = `${tempF.toFixed(1)} °F`;
            
            checkDataFreshness(latest.dateTime, "waterTempTime");
        } else {
            document.getElementById("waterTempCurrent").textContent = "Data Gap";
        }
    } catch (e) {
        console.error("Water Temp Error:", e);
        document.getElementById("waterTempCurrent").textContent = "Offline";
    }
}


async function loadLakeFrancisData() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;
        
        if (rawValues.length >= 2) {
            const latest = rawValues[rawValues.length - 1];
            const prev = rawValues[rawValues.length - 2];
            const trend = getTrendHTML(parseFloat(latest.value), parseFloat(prev.value));

            document.getElementById("lakeFrancisCurrent").innerHTML = `${parseFloat(latest.value).toFixed(2)} ft ${trend}`;
            checkDataFreshness(latest.dateTime, "lakeFrancisTime");

            // Map data for the Stage Chart
            const chartData = rawValues.map(v => ({
                t: new Date(v.dateTime),
                y: parseFloat(v.value)
            }));
            
            updateLakeChart(chartData);
        }
    } catch (e) { console.error("Lake Graph Error:", e); }
}

async function loadSSKPData() {
    // 1. Get 7 days of data so the graph isn't empty
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195430&parameterCd=00065&period=P7D";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const rawValues = data.value.timeSeries[0].values[0].value;
        
        if (rawValues.length >= 2) {
            // 2. Trend Logic (Last vs Second-to-Last)
            const latestRaw = rawValues[rawValues.length - 1];
            const prevRaw = rawValues[rawValues.length - 2];
            
            const currentCFS = ratingCurve_CFS(latestRaw.value);
            const prevCFS = ratingCurve_CFS(prevRaw.value);
            const trend = getTrendHTML(currentCFS, prevCFS);

            document.getElementById("siloamCurrent").innerHTML = `${currentCFS.toFixed(1)} CFS ${trend}`;
            checkDataFreshness(latestRaw.dateTime, "siloamTime");

            // 3. GRAPHING LOGIC (The missing piece)
            // Map the 7-day data through your rating curve for the chart
            const chartData = rawValues.map(v => ({
                t: new Date(v.dateTime),
                y: ratingCurve_CFS(v.value)
            }));
            
            // Call your existing chart function (make sure the name matches yours)
            updateSiloamChart(chartData); 
        }
    } catch (e) { console.error("SSKP Graph Error:", e); }
}


// -----------------------------------------------------
// 9. HWY 16 GAUGE (DIRECT CFS) - USGS-07195400
// -----------------------------------------------------
async function loadHwy16Data() {
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195400&parameterCd=00060&period=PT2H";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const values = data.value.timeSeries[0].values[0].value;
        
        if (values.length >= 2) {
            const current = parseFloat(values[values.length - 1].value);
            const previous = parseFloat(values[values.length - 2].value);
            const trend = getTrendHTML(current, previous);

            document.getElementById("hwy16Current").innerHTML = 
                `${Math.round(current).toLocaleString()} CFS ${trend}`;
            checkDataFreshness(values[values.length - 1].dateTime, "hwy16Time");
        }
    } catch (e) { console.error("Hwy 16 Trend Error", e); }
}



// -----------------------------------------------------
// 10. Illinois River near Savay Gauge
// -----------------------------------------------------
async function loadSavoyData() {
    // Note: We add &period=PT2H to get the last 2 hours of data for trend comparison
    const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07194800&parameterCd=00060&period=PT2H";
    try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const values = data.value.timeSeries[0].values[0].value;
        
        if (values.length >= 2) {
            const current = parseFloat(values[values.length - 1].value);
            const previous = parseFloat(values[values.length - 2].value);
            
            const trend = getTrendHTML(current, previous);
            
            document.getElementById("savoyCurrent").innerHTML = 
                `${Math.round(current).toLocaleString()} CFS ${trend}`;
            
            checkDataFreshness(values[values.length - 1].dateTime, "savoyTime");
        }
    } catch (e) { console.error("Savoy Trend Error", e); }
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
        await loadWaterTempData();
        await loadLakeFrancisData();
        await loadSSKPData();
        await loadHwy16Data(); // Ensure this function name matches exactly!
        await loadSavoyData();
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
