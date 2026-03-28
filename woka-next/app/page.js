"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    console.log("Dashboard mounted in Next.js");
  }, []);

  return (
    <main style={{ padding: "20px" }}>
      <h1>WOKA Dashboard (Next.js Version)</h1>

      <p>
        The dashboard components will appear here as we migrate them piece by piece.
      </p>

      <div id="dashboard-root"></div>
    </main>
  );
}
