console.log("App.js is running");

// -------------------------------------
// Fetch Air Temperature (Open-Meteo)
// -------------------------------------
async function getAirTemperature() {
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
    document.getElementById("airTemp").textContent = `${temp} °F`;

  } catch (err) {
    document.getElementById("airTemp").textContent = "Error loading data";
    console.error("Open-Meteo fetch error:", err);
  }
}

// -----------------------------------------------------
// LAKE FRANCIS GRAPH (7-DAY)
// -----------------------------------------------------
async function loadLakeFrancisGraph() {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195495&parameterCd=00065&period=P7D";

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

    const lakeChart = new Chart(ctx, {
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

        interaction: {
          mode: "index",
          intersect: false,
        },

        plugins: {
          tooltip: {
            enabled: true,
            displayColors: false,
            bodyFont: { size: 16 },
            titleFont: { size: 14 }
          },
          legend: { display: true }
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
    });

    // ✅ Mobile + desktop scrub readout
    const scrub = document.getElementById("scrubValue");

    function updateReadout(event) {
      const points = lakeChart.getElementsAtEventForMode(
        event,
        "index",
        { intersect: false },
        true
      );

      if (points.length) {
        const i = points[0].index;
        scrub.textContent = `${labels[i]} — ${heights[i]} ft`;
      }
    }

    ctx.addEventListener("mousemove", updateReadout);
    ctx.addEventListener("touchmove", updateReadout);

  } catch (err) {
    console.error("Error loading Lake Francis data:", err);
  }
}

// -----------------------------------------------------
// CURRENT LAKE FRANCIS LEVEL
// -----------------------------------------------------
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
// -----------------------------------------------------
// SILOAM SPRINGS (USGS 07195800) – CURRENT FLOW (CFS)
// -----------------------------------------------------
async function loadSiloamCurrent() {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195800&parameterCd=00060";

  try {
    const res = await fetch(url);
    const data = await res.json();

    const value =
      data.value.timeSeries[0].values[0].value[0].value;

    document.getElementById("siloamCurrent").textContent =
      value + " CFS";

  } catch (err) {
    console.error("Error loading Siloam current flow:", err);
    document.getElementById("siloamCurrent").textContent =
      "Error loading data";
  }
}

// -----------------------------------------------------
// SILOAM SPRINGS – 7 DAY FLOW GRAPH (CFS)
// -----------------------------------------------------
async function loadSiloamGraph() {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07195800&parameterCd=00060&period=P7D";

  try {
    const res = await fetch(url);
    const data = await res.json();

    const series = data.value.timeSeries[0].values[0].value;

    const labels = series.map(v =>
      new Date(v.dateTime).toLocaleDateString()
    );

    const cfs = series.map(v =>
      parseFloat(v.value)
    );

    const ctx = document.getElementById("siloamChart");

    const siloamChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Flow (CFS)",
          data: cfs,
          borderColor: "#cc5500",
          backgroundColor: "rgba(204, 85, 0, 0.3)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: "index",
          intersect: false,
        },

        plugins: {
          tooltip: {
            enabled: true,
            displayColors: false,
            bodyFont: { size: 16 },
            titleFont: { size: 14 }
          },
          legend: { display: true }
        },

        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: { autoSkip: true, maxRotation: 0 }
          },
          y: {
            title: { display: true, text: "CFS" }
          }
        }
      }
    });

    // ✅ Live scrub readout
    const scrub = document.getElementById("siloamScrub");

    function updateReadout(evt) {
      const points = siloamChart.getElementsAtEventForMode(
        evt,
        "index",
        { intersect: false },
        true
      );

      if (points.length) {
        const i = points[0].index;
        scrub.textContent = `${labels[i]} — ${cfs[i]} CFS`;
      }
    }

    ctx.addEventListener("mousemove", updateReadout);
    ctx.addEventListener("touchmove", updateReadout);

  } catch (err) {
    console.error("Error loading Siloam graph:", err);
  }
}


// -----------------------------------------------------
// RUN EVERYTHING
// -----------------------------------------------------
getAirTemperature();
loadLakeFrancisGraph();
loadLakeFrancisCurrent();
loadSiloamCurrent();
loadSiloamGraph();

