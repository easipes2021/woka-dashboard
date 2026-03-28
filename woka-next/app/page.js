"use client";

import AirTempCard from "./components/AirTempCard";

export default function Home() {
  return (
    <main>
      <h1 style={{ textAlign: "center" }}>WOKA Dashboard (Next.js)</h1>

      <AirTempCard />

      {/* More cards will go here as we convert them */}
    </main>
  );
}

