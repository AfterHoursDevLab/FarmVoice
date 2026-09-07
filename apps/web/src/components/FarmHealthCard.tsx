"use client";

import { FarmAssessment, FarmState } from "@farmvoice/shared";

const SEVERITY_LABEL = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  resolved: "Resolved",
} as const;

const SEVERITY_ICON: Record<string, string> = {
  normal: "🟢",
  warning: "🟡",
  critical: "🔴",
  resolved: "🟢",
};

export function FarmHealthCard({
  state,
  assessment,
}: {
  state: FarmState;
  assessment: FarmAssessment | null;
}) {
  const issues = assessment?.issues ?? [];
  const allHandled =
    issues.length > 0 &&
    issues.every((i) => {
      const h: Record<string, "ac" | "fan" | "irrigation"> = {
        temperature_high: "ac",
        soil_moisture_low: "irrigation",
        humidity_high: "fan",
      };
      const key = h[i.key];
      return key ? state[key] === "on" : true;
    });

  const severity = allHandled
    ? "resolved"
    : issues.length === 0
      ? "normal"
      : (assessment?.overallSeverity ?? "normal");

  const count = issues.length;

  return (
    <section className={`health-hero health-${severity}`}>
      <div className="health-main">
        <span className="health-label">Farm Health</span>
        <span className="health-big">
          {SEVERITY_ICON[severity]} {SEVERITY_LABEL[severity]}
        </span>
      </div>

      <div className="health-readout">
        <div className="health-tile">
          <span className="tile-icon">🌡️</span>
          <span className="tile-value">{state.temperatureC.toFixed(1)}°C</span>
          <span className="tile-label">Temp</span>
        </div>
        <div className="health-tile">
          <span className="tile-icon">💧</span>
          <span className="tile-value">{Math.round(state.humidityPct)}%</span>
          <span className="tile-label">Humidity</span>
        </div>
        <div className="health-tile">
          <span className="tile-icon">🌱</span>
          <span className="tile-value">{Math.round(state.soilMoisturePct)}%</span>
          <span className="tile-label">Soil</span>
        </div>
      </div>

      <div className="health-issues">
        {count === 0
          ? "All readings within range"
          : allHandled
            ? "Resolved · equipment running"
            : `${count} Active ${count === 1 ? "Issue" : "Issues"}`}
      </div>
    </section>
  );
}
