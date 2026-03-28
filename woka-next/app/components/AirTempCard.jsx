"use client";

import { useEffect, useState } from "react";

export default function AirTempCard() {
  const [tempF, setTempF] = useState("--");
  const [timestamp, setTimestamp] = useState("--");

  useEffect(() => {
    async function fetchAirTemp() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=-94.57&current=temperature_2m&temperature_unit=fahrenheit"
        );
        const data = await res.json();

        if (data?.current?.temperature_2m !== undefined) {
          setTempF(data.current.temperature_2m);
          setTimestamp(
            new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          );
        }
      } catch (err) {
        console.error("Air Temperature API Error", err);
        setTempF("Offline");
      }
    }

    fetchAirTemp();

    // refresh every 15 minutes
    const interval = setInterval(fetchAirTemp, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card">
      <h2>Watts Air Temperature</h2>
      <p className="big-number">{tempF} °F</p>
      <div className="timestamp">Updated: {timestamp}</div>
    </div>
  );
}
