"use client";

import AirTempCard from "./components/AirTempCard";

export default function Page() {
  return (
    <main style={styles.container}>
      <h1 style={styles.header}>WOKA Dashboard Preview</h1>

      {/* Vertical stacking layout */}
      <AirTempCard />

      {/* More cards will be added below */}
    </main>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px"
  },
  header: {
    fontSize: "28px",
    fontWeight: "700",
    marginBottom: "24px"
  }
};
