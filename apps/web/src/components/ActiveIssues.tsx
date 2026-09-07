"use client";

import { FarmAssessment, FarmState } from "@farmvoice/shared";

export function ActiveIssues({
  assessment,
  state,
}: {
  assessment: FarmAssessment | null;
  state: FarmState;
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

  return (
    <section className="card">
      <h3 className="sub">Active issues</h3>
      {issues.length === 0 ? (
        <p className="muted">All readings within target ranges.</p>
      ) : (
        <ul className="issue-list">
          {issues.map((i) => (
            <li key={i.key} className={`issue issue-${i.severity}`}>
              <span className="issue-title">{i.title ?? i.message}</span>
              {i.label && <span className="issue-label">{i.label}</span>}
              <span className={`tag tag-${i.severity}`}>
                {allHandled ? "Resolved" : i.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
