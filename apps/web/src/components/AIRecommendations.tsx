"use client";

import { FarmAssessment, Impact, Recommendation } from "@farmvoice/shared";

const ACTION_LABEL: Record<string, string> = {
  control_ac: "Turn AC",
  control_fan: "Turn fan",
  control_irrigation: "Start irrigation",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function metricLabel(metric?: Recommendation["metric"]) {
  return metric === "temperatureC"
    ? "Temperature"
    : metric === "soilMoisturePct"
      ? "Soil moisture"
      : metric === "humidityPct"
        ? "Humidity"
        : "";
}

function unit(metric?: Recommendation["metric"]) {
  return metric === "temperatureC" ? "°C" : "%";
}

function whyLines(r: Recommendation): string[] {
  if (!r.metric || r.detected === undefined) return [];
  const lines = [`${metricLabel(r.metric)}: ${r.detected}${unit(r.metric)}`];
  if (r.threshold !== undefined) {
    const kind = r.thresholdKind === "critical" ? "Critical" : "Target";
    const dir = r.metric === "temperatureC" ? "<" : ">";
    lines.push(`${kind}: ${dir}${r.threshold}${unit(r.metric)}`);
  }
  return lines;
}

function RecCard({ r }: { r: Recommendation }) {
  const statusText =
    r.impact === "high"
      ? "Confirmation required"
      : r.impact === "medium"
        ? "Waiting for confirmation"
        : "Low impact · auto";

  return (
    <li className="rec">
      <div className="rec-head">
        <span className="rec-action">
          {ACTION_LABEL[r.tool]} {r.args.state.toUpperCase()}
        </span>
      </div>
      <div className="rec-rows">
        <div className="rec-row">
          <span className="rec-row-label">WHY</span>
          <span className="rec-row-value rec-why">
            {whyLines(r).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </span>
        </div>
        <div className="rec-row">
          <span className="rec-row-label">IMPACT</span>
          <span className="rec-row-value">{IMPACT_LABEL[r.impact]}</span>
        </div>
        <div className="rec-row">
          <span className="rec-row-label">ACTION</span>
          <span className={`rec-row-value rec-status rec-status-${r.impact}`}>
            {statusText}
          </span>
        </div>
      </div>
    </li>
  );
}

export function AIRecommendations({
  assessment,
}: {
  assessment: FarmAssessment | null;
}) {
  const recs = assessment?.recommendations ?? [];
  return (
    <section className="card">
      <h3 className="sub">AI recommendations</h3>
      {recs.length === 0 ? (
        <p className="muted">No equipment action needed.</p>
      ) : (
        <ul className="rec-list">
          {recs.map((r, idx) => (
            <RecCard key={idx} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

export type { Impact };