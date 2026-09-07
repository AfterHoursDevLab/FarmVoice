import {
  FarmAssessment,
  FarmState,
  Impact,
  Issue,
  Recommendation,
  Severity,
} from "@farmvoice/shared";

/** Safety matrix: how impactful is switching each device on/off? */
export const CONTROL_IMPACT: Record<
  "control_ac" | "control_fan" | "control_irrigation",
  Record<"on" | "off", Impact>
> = {
  control_ac: { on: "medium", off: "low" },
  control_fan: { on: "low", off: "low" },
  control_irrigation: { on: "high", off: "low" },
};

function classify(
  value: number,
  low: number,
  criticalLow: number,
  high?: number,
  criticalHigh?: number,
): Severity {
  if (criticalLow !== undefined && value < criticalLow) return "critical";
  if (value < low) return "warning";
  if (high !== undefined && criticalHigh !== undefined && value > criticalHigh) {
    return "critical";
  }
  if (high !== undefined && value > high) return "warning";
  return "normal";
}

const tempSeverity = (v: number): Severity => {
  if (v >= 38) return "critical";
  if (v > 30) return "warning";
  return "normal";
};

const humiditySeverity = (v: number) => classify(v, 40, 30, 85, 92);
const soilSeverity = (v: number) => classify(v, 30, 25);

export function assess(state: FarmState): FarmAssessment {
  const issues: Issue[] = [];
  const recommendations: Recommendation[] = [];

  const readingStatus = {
    temperatureC: tempSeverity(state.temperatureC),
    humidityPct: humiditySeverity(state.humidityPct) as Severity,
    soilMoisturePct: soilSeverity(state.soilMoisturePct) as Severity,
  };

  if (state.temperatureC > 30 && state.ac === "off") {
    issues.push({
      key: "temperature_high",
      severity: readingStatus.temperatureC as Issue["severity"],
      message: `Temperature is ${state.temperatureC}°C, above the 30°C target`,
      title: "High temperature",
      label: `${state.temperatureC}°C > 30°C`,
    });
    recommendations.push({
      tool: "control_ac",
      args: { state: "on" },
      impact: CONTROL_IMPACT.control_ac.on,
      reason: "Temperature is above 30°C and the AC is off",
      metric: "temperatureC",
      detected: state.temperatureC,
      threshold: 30,
      thresholdKind: "target",
    });
  }

  if (state.humidityPct < 40 && state.fan === "off") {
    issues.push({
      key: "humidity_low",
      severity: humiditySeverity(state.humidityPct) as Issue["severity"],
      message: `Humidity is only ${state.humidityPct}%, below 40%`,
      title: "Low humidity",
      label: `${state.humidityPct}% < 40%`,
    });
    recommendations.push({
      tool: "control_fan",
      args: { state: "on" },
      impact: CONTROL_IMPACT.control_fan.on,
      reason: "Humidity is below 40% and the fan is off",
      metric: "humidityPct",
      detected: state.humidityPct,
      threshold: 40,
      thresholdKind: "target",
    });
  }

  if (state.humidityPct > 85 && state.fan === "off") {
    issues.push({
      key: "humidity_high",
      severity: humiditySeverity(state.humidityPct) as Issue["severity"],
      message: `Humidity is ${state.humidityPct}%, above 85%`,
      title: "High humidity",
      label: `${state.humidityPct}% > 85%`,
    });
    recommendations.push({
      tool: "control_fan",
      args: { state: "on" },
      impact: CONTROL_IMPACT.control_fan.on,
      reason: "Humidity is above 85% and the fan is off",
      metric: "humidityPct",
      detected: state.humidityPct,
      threshold: 85,
      thresholdKind: "target",
    });
  }

  if (state.soilMoisturePct < 30 && state.irrigation === "off") {
    issues.push({
      key: "soil_moisture_low",
      severity: soilSeverity(state.soilMoisturePct) as Issue["severity"],
      message: `Soil moisture is ${state.soilMoisturePct}%, below 30%`,
      title: "Low soil moisture",
      label: `${state.soilMoisturePct}% < 30%`,
    });
    recommendations.push({
      tool: "control_irrigation",
      args: { state: "on" },
      impact: CONTROL_IMPACT.control_irrigation.on,
      reason: "Soil moisture is below 30% and irrigation is off",
      metric: "soilMoisturePct",
      detected: state.soilMoisturePct,
      threshold: state.soilMoisturePct < 25 ? 25 : 30,
      thresholdKind: state.soilMoisturePct < 25 ? "critical" : "target",
    });
  }

  const severityRank: Record<Severity, number> = {
    normal: 0,
    warning: 1,
    critical: 2,
  };
  // Overall health comes from the raw readings, not from whether equipment is
  // already mitigating them.
  const overallSeverity = (
    ["temperatureC", "humidityPct", "soilMoisturePct"] as const
  ).reduce<Severity>(
    (worst, key) =>
      severityRank[readingStatus[key]] > severityRank[worst]
        ? readingStatus[key]
        : worst,
    "normal",
  );

  return {
    timestamp: new Date().toISOString(),
    readings: {
      temperatureC: state.temperatureC,
      humidityPct: state.humidityPct,
      soilMoisturePct: state.soilMoisturePct,
    },
    equipment: {
      ac: state.ac,
      fan: state.fan,
      irrigation: state.irrigation,
    },
    readingStatus,
    overallSeverity,
    healthy: overallSeverity === "normal",
    issues,
    recommendations,
  };
}