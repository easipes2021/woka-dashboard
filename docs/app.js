/**
 * WOKA / Illinois River Dashboard
 * Refactored production-ready app.js
 */

console.log("WOKA Dashboard app.js loading...");

/* -----------------------------------
   1) CONFIG
----------------------------------- */

const CONFIG = {
  refreshIntervalMs: 15 * 60 * 1000,
  freshnessThresholdMinutes: 120,

  weather: {
    latitude: 36.13,
    longitude: -94.57
  },

  usgs: {
    waterTempSite: "07195500",
    lakeFrancisSite: "07195495",
    sskpSite: "07195430",
    hwy16Site: "07195400",
    savoySite: "07194800",

    params: {
      stage: "00065",
      discharge: "00060",
      waterTemp: "00010"
    }
  },

  sskpCurve: {
    breakpointFt: 5.416,
    lowCoeff: 21.28,
    lowExp: 2.04,
    highCoeff: 2.73,
    highExp: 3.019,
    continuityAdjust: true
  }
};

/* -----------------------------------
   2) STATE
----------------------------------- */

const state = {
  charts: {
    lake: null,
    sskpMini: null,
    sskpFull: null
  },
  refreshInProgress: false,
  refreshTimer: null
};

/* -----------------------------------
   3) DOM HELPERS
----------------------------------- */

function byId(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = byId(id);
  if (el) el.innerHTML = html;
}

function setOffline(currentId, timeId, currentMessage = "Offline", timeMessage = "Unavailable") {
  setText(currentId, currentMessage);
  setText(timeId, timeMessage);
}

function safeNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/* -----------------------------------
   4) TIME / STATUS HELPERS
----------------------------------- */

function formatClockTime(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "--:--";

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function checkDataFreshness(dateTimeStr, elementId) {
  const el = byId(elementId);
  if (!el) return;

  const dataTime = new Date(dateTimeStr);
  if (Number.isNaN(dataTime.getTime())) {
    el.textContent = "Unavailable";
    el.classList.remove("data-delayed");
    return;
  }

  const ageMinutes = (Date.now() - dataTime.getTime()) / (1000 * 60);
  const formatted = formatClockTime(dataTime);

  if (ageMinutes > CONFIG.freshnessThresholdMinutes) {
    el.textContent = `DELAYED: ${formatted}`;
    el.classList.add("data-delayed");
  } else {
    el.textContent = `Updated: ${formatted}`;
    el.classList.remove("data-delayed");
  }
}

/* -----------------------------------
   5) TREND ENGINE
----------------------------------- */

function getTrendHTML(current, previous) {
  const curr = safeNumber(current);
  const prev = safeNumber(previous, curr);

  const diff = curr - prev;
  const threshold = Math.max(Math.abs(curr) * 0.005, 0.1);

  if (diff > threshold) {
    return '<span class="trend-arrow trend-rising" aria-label="rising">▲</span>';
  }

  if (diff < -threshold) {
    return '<span class="trend-arrow trend-falling" aria-label="falling">▼</span>';
  }

  return '<span class="trend-arrow trend-steady" aria-label="steady">▶</span>';
}

/* -----------------------------------
   6) SSKP RATING CURVE
----------------------------------- */

function ratingCurveCFS(gageHeightFt) {
  const H = safeNumber(gageHeightFt, NaN);
  if (!Number.isFinite(H) || H <= 0) return 0;

  const {
    breakpointFt,
    lowCoeff,
    lowExp,
    highCoeff,
    highExp,
    continuityAdjust
  } = CONFIG.sskpCurve;

  const lowBranch = (x) => lowCoeff * Math.pow(x, lowExp);
  const highBranch = (x) => highCoeff * Math.pow(x, highExp);

  if (H <= breakpointFt) {
    return lowBranch(H);
  }

  if (!continuityAdjust) {
    return highBranch(H);
  }

  const lowAtBreak = lowBranch(breakpointFt);
  const highAtBreak = highBranch(breakpointFt);

  if (!Number.isFinite(highAtBreak) || highAtBreak <= 0) {
    return highBranch(H);
  }

  const scaleFactor = lowAtBreak / highAtBreak;
  return highBranch(H) * scaleFactor;
}

/* -----------------------------------
   7) FETCH HELPERS
----------------------------------- */

async function fetchJSON(url) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

function buildUSGSUrl({ site, parameterCd, period }) {
  const params = new URLSearchParams({
    format: "json",
    sites: site,
    parameterCd,
    period
  });

  return `https://waterservices.usgs.gov/nwis/iv/?${params.toString()}`;
}

async function fetchUSGS({ site, parameterCd, period }) {
  const url = buildUSGSUrl({ site, parameterCd, period });
  return fetchJSON(url);
}

function getUSGSValues(data) {
  return data?.value?.timeSeries?.[0]?.values?.[0]?.value ?? [];
}

function getLatestAndPrevious(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { latest: null, previous: null };
  }

  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : latest;

  return { latest, previous };
}

/* -----------------------------------
   8) THEME + CHART COLOR HELPERS
----------------------------------- */

function getThemeColors() {
  const darkMode = document.body.classList.contains("dark-mode");

  return {
    text: darkMode ? "#e5e7eb" : "#374151",
    grid: darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    lakeLine: "#0077cc",
    lakeFill: "rgba(0, 119, 204, 0.12)",
    flowLine: "#16a34a",
    flowFill: "rgba(22, 163, 74, 0.12)"
  };
}

function destroyChart(chartRef) {
  if (chartRef && typeof chartRef.destroy === "function") {
    chartRef.destroy();
  }
}

function deepMerge(base, override) {
  const output = { ...base };

  Object.keys(override || {}).forEach((key) => {
    const baseVal = output[key];
    const overrideVal = override[key];

    if (
      baseVal &&
      overrideVal &&
      typeof baseVal === "object" &&
      typeof overrideVal === "object" &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      output[key] = deepMerge(baseVal, overrideVal);
    } else {
      output[key] = overrideVal;
    }
  });

  return output;
}

function createLineChart(canvasId, chartRefKey, datasetConfig, optionsConfig = {}) {
  const canvas = byId(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;

  destroyChart(state.charts[chartRefKey]);

  const colors = getThemeColors();

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    events: ["mousemove", "mouseout", "click", "touchstart", "touchmove", "touchend"],
    scales: {
      x: {
        type: "time",
        time: { unit: "day" },
        ticks: { color: colors.text },
        grid: { color: colors.grid }
      },
      y: {
        beginAtZero: false,
        ticks: { color: colors.text },
        grid: { color: colors.grid }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        position: "nearest"
      }
    }
  };

  const mergedOptions = deepMerge(defaultOptions, optionsConfig);

  state.charts[chartRefKey] = new Chart(canvas, {
    type: "line",
    data: {
      datasets: [datasetConfig]
    },
    options: mergedOptions
  });

  return state.charts[chartRefKey];
}

function updateLakeChart(chartData) {
  const colors = getThemeColors();

  createLineChart(
    "lakeFrancisChart",
    "lake",
    {
      label: "Stage (ft)",
      data: chartData,
      borderColor: colors.lakeLine,
      backgroundColor: colors.lakeFill,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2
    },
    {
      plugins: {
        tooltip: {
          position: "nearest",
          callbacks: {
            label(context) {
              const value = safeNumber(context?.parsed?.y).toFixed(2);
              const scrub = byId("scrubValue");
              if (scrub) {
                scrub.textContent = `Stage: ${value} ft`;
              }
              return `${value} ft`;
            }
          }
        }
      }
    }
  );
}

function updateSiloamMiniChart(chartData) {
  const colors = getThemeColors();

  createLineChart(
    "siloamChart",
    "sskpMini",
    {
      label: "Flow (CFS)",
      data: chartData,
      borderColor: colors.flowLine,
      backgroundColor: colors.flowFill,
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2
    },
    {
      scales: {
        x: { display: false },
        y: { display: false }
      },
      plugins: {
        tooltip: { enabled: false }
      }
    }
  );
}

function updateConvertedFullChart(chartData) {
  const colors = getThemeColors();

  createLineChart(
    "convertedChart",
    "sskpFull",
    {
      label: "7-Day Flow (CFS)",
      data: chartData,
      borderColor: colors.flowLine,
      backgroundColor: colors.flowFill,
      fill: true,
      tension: 0.2,
      pointRadius: 0,
      borderWidth: 2
    },
    {
      plugins: {
        tooltip: {
          position: "nearest",
          callbacks: {
            label(context) {
              const value = safeNumber(context?.parsed?.y).toFixed(1);
              const scrub = byId("convertedScrub");
              if (scrub) {
                scrub.textContent = `Flow: ${value} CFS`;
              }
              return `${value} CFS`;
            }
          }
        }
      }
    }
  );
}

function restyleAllCharts() {
  const chartEntries = Object.values(state.charts).filter(Boolean);
  if (!chartEntries.length) return;

  const colors = getThemeColors();

  chartEntries.forEach((chart) => {
    const xScale = chart?.options?.scales?.x;
    const yScale = chart?.options?.scales?.y;

    if (xScale?.ticks) xScale.ticks.color = colors.text;
    if (yScale?.ticks) yScale.ticks.color = colors.text;
    if (xScale?.grid) xScale.grid.color = colors.grid;
    if (yScale?.grid) yScale.grid.color = colors.grid;

    const dataset = chart?.data?.datasets?.[0];
    if (dataset?.label?.includes("Stage")) {
      dataset.borderColor = colors.lakeLine;
      dataset.backgroundColor = colors.lakeFill;
    } else {
      dataset.borderColor = colors.flowLine;
      dataset.backgroundColor = colors.flowFill;
    }

    chart.update("none");
  });
}

/* -----------------------------------
   9) DATA TRANSFORM HELPERS
----------------------------------- */

function toStageChartData(values) {
  return values
    .map((v) => ({
      x: new Date(v.dateTime),
      y: safeNumber(v.value, NaN)
    }))
    .filter((point) => Number.isFinite(point.y) && !Number.isNaN(point.x.getTime()));
}

function toSSKPChartData(values) {
  return values
    .map((v) => ({
      x: new Date(v.dateTime),
      y: ratingCurveCFS(v.value)
    }))
    .filter((point) => Number.isFinite(point.y) && !Number.isNaN(point.x.getTime()));
}

/* -----------------------------------
   10) LOADERS
----------------------------------- */

async function getAirTemperature() {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: CONFIG.weather.latitude,
      longitude: CONFIG.weather.longitude,
      current: "temperature_2m",
      temperature_unit: "fahrenheit"
    }).toString();

    const data = await fetchJSON(url.toString());
    const temp = data?.current?.temperature_2m;

    if (!Number.isFinite(temp)) {
      throw new Error("Air temperature unavailable");
    }

    setText("airTemp", `${temp} °F`);
    setText("airTempTime", `Updated: ${formatClockTime(new Date())}`);
  } catch (error) {
    console.error("Air Temp Fail", error);
    setOffline("airTemp", "airTempTime");
  }
}

async function loadWaterTempData() {
  try {
    const data = await fetchUSGS({
      site: CONFIG.usgs.waterTempSite,
      parameterCd: CONFIG.usgs.params.waterTemp,
      period: "PT24H"
    });

    const values = getUSGSValues(data);
    const { latest } = getLatestAndPrevious(values);

    if (!latest) {
      setOffline("waterTempCurrent", "waterTempTime", "No data", "Unavailable");
      return;
    }

    const tempC = safeNumber(latest.value, NaN);
    if (!Number.isFinite(tempC)) {
      throw new Error("Invalid water temperature");
    }

    const tempF = (tempC * 9) / 5 + 32;
    setText("waterTempCurrent", `${tempF.toFixed(1)} °F`);
    checkDataFreshness(latest.dateTime, "waterTempTime");
  } catch (error) {
    console.error("Water Temp Fail", error);
    setOffline("waterTempCurrent", "waterTempTime");
  }
}

async function loadLakeFrancisData() {
  try {
    const data = await fetchUSGS({
      site: CONFIG.usgs.lakeFrancisSite,
      parameterCd: CONFIG.usgs.params.stage,
      period: "P7D"
    });

    const values = getUSGSValues(data);
    const { latest, previous } = getLatestAndPrevious(values);

    if (!latest) {
      setOffline("lakeFrancisCurrent", "lakeFrancisTime", "No data", "Unavailable");
      setText("lakeFrancisGraphTime", "Unavailable");
      return;
    }

    const currentStage = safeNumber(latest.value, NaN);
    const previousStage = previous ? safeNumber(previous.value, currentStage) : currentStage;

    if (!Number.isFinite(currentStage)) {
      throw new Error("Invalid Lake Francis stage");
    }

    const trend = getTrendHTML(currentStage, previousStage);
    setHTML("lakeFrancisCurrent", `${currentStage.toFixed(2)} ft ${trend}`);

    const chartData = toStageChartData(values);
    updateLakeChart(chartData);

    checkDataFreshness(latest.dateTime, "lakeFrancisTime");
    checkDataFreshness(latest.dateTime, "lakeFrancisGraphTime");
  } catch (error) {
    console.error("Lake Francis Fail", error);
    setOffline("lakeFrancisCurrent", "lakeFrancisTime");
    setText("lakeFrancisGraphTime", "Unavailable");
  }
}

async function loadSSKPData() {
  try {
    const data = await fetchUSGS({
      site: CONFIG.usgs.sskpSite,
      parameterCd: CONFIG.usgs.params.stage,
      period: "P7D"
    });

    const values = getUSGSValues(data);
    const { latest, previous } = getLatestAndPrevious(values);

    if (!latest) {
      setOffline("siloamCurrent", "siloamTime", "No data", "Unavailable");
      setText("convertedGraphTime", "Unavailable");
      return;
    }

    const currentCFS = ratingCurveCFS(latest.value);
    const previousCFS = previous ? ratingCurveCFS(previous.value) : currentCFS;

    const trend = getTrendHTML(currentCFS, previousCFS);
    setHTML("siloamCurrent", `${currentCFS.toFixed(1)} CFS ${trend}`);

    checkDataFreshness(latest.dateTime, "siloamTime");

    const chartData = toSSKPChartData(values);
    updateSiloamMiniChart(chartData);
    updateConvertedFullChart(chartData);

    checkDataFreshness(latest.dateTime, "convertedGraphTime");
  } catch (error) {
    console.error("SSKP Fail", error);
    setOffline("siloamCurrent", "siloamTime");
    setText("convertedGraphTime", "Unavailable");
  }
}

async function loadFlowCard({ site, currentId, timeId, period = "PT2H" }) {
  try {
    const data = await fetchUSGS({
      site,
      parameterCd: CONFIG.usgs.params.discharge,
      period
    });

    const values = getUSGSValues(data);
    const { latest, previous } = getLatestAndPrevious(values);

    if (!latest) {
      setOffline(currentId, timeId, "No data", "Unavailable");
      return;
    }

    const current = safeNumber(latest.value, NaN);
    const previousValue = previous ? safeNumber(previous.value, current) : current;

    if (!Number.isFinite(current)) {
      throw new Error(`Invalid discharge for ${site}`);
    }

    const trend = getTrendHTML(current, previousValue);
    setHTML(currentId, `${Math.round(current).toLocaleString()} CFS ${trend}`);
    checkDataFreshness(latest.dateTime, timeId);
  } catch (error) {
    console.error(`Flow card fail for ${site}`, error);
    setOffline(currentId, timeId);
  }
}

async function loadHwy16Data() {
  return loadFlowCard({
    site: CONFIG.usgs.hwy16Site,
    currentId: "hwy16Current",
    timeId: "hwy16Time"
  });
}

async function loadSavoyData() {
  return loadFlowCard({
    site: CONFIG.usgs.savoySite,
    currentId: "savoyCurrent",
    timeId: "savoyTime"
  });
}

/* -----------------------------------
   11) APP LIFECYCLE
----------------------------------- */

function updateThemeButtonLabel() {
  const btn = byId("themeToggle");
  if (!btn) return;

  const isDark = document.body.classList.contains("dark-mode");
  btn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function initThemeToggle() {
  const themeBtn = byId("themeToggle");
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }

  updateThemeButtonLabel();

  if (!themeBtn) return;

  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    updateThemeButtonLabel();
    restyleAllCharts();
  });
}

async function refreshAllData() {
  if (state.refreshInProgress) {
    console.log("Refresh skipped: previous cycle still running.");
    return;
  }

  state.refreshInProgress = true;
  console.log("Refreshing all dashboard data...");

  try {
    await Promise.allSettled([
      getAirTemperature(),
      loadWaterTempData(),
      loadLakeFrancisData(),
      loadSSKPData(),
      loadHwy16Data(),
      loadSavoyData()
    ]);
  } finally {
    state.refreshInProgress = false;
    console.log("Refresh cycle complete.");
  }
}

function initApp() {
  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded. Charts will not render.");
  }

  initThemeToggle();
  refreshAllData();

  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }

  state.refreshTimer = setInterval(refreshAllData, CONFIG.refreshIntervalMs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
