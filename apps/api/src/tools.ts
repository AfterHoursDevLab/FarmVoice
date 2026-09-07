import {
  ControlArgs,
  FarmAssessment,
  FarmHistory,
  FarmState,
  FarmToolName,
  Impact,
  MetricTrend,
} from "@farmvoice/shared";
import { assess, CONTROL_IMPACT } from "./assess";
import { getState, setState } from "./state";
import {
  appendAgentDecision,
  appendEquipmentEvent,
  listSensorHistory,
} from "./db";

const CONTROL_KEY: Record<
  "control_ac" | "control_fan" | "control_irrigation",
  "ac" | "fan" | "irrigation"
> = {
  control_ac: "ac",
  control_fan: "fan",
  control_irrigation: "irrigation",
};

const DEVICE_LABEL: Record<"control_ac" | "control_fan" | "control_irrigation", string> = {
  control_ac: "AC",
  control_fan: "Fan",
  control_irrigation: "Irrigation",
};

function trend(samples: { temperatureC: number; humidityPct: number; soilMoisturePct: number }[]) {
  const mk = (key: "temperatureC" | "humidityPct" | "soilMoisturePct"): MetricTrend => {
    const values = samples.map((s) => s[key]);
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    return {
      first,
      last,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      delta: Math.round((last - first) * 10) / 10,
    };
  };
  return { temperatureC: mk("temperatureC"), humidityPct: mk("humidityPct"), soilMoisturePct: mk("soilMoisturePct") };
}

export type ToolResult =
  | FarmState
  | FarmAssessment
  | FarmHistory
  | {
      ok: true;
      device: string;
      state: "on" | "off";
      impact: Impact;
      confirmed: boolean;
    }
  | {
      ok: false;
      code?: string;
      device?: string;
      impact?: Impact;
      message?: string;
      error?: string;
    };

export type ToolArgs = ControlArgs & { minutes?: number };

/**
 * Execute one of the FarmVoice agent tools against the shared farm state.
 * Read-only tools (status / assessment) just return data. Control tools go
 * through the safety matrix: high-impact actions (irrigation ON) are refused
 * unless explicitly confirmed.
 */
export async function runTool(
  name: FarmToolName,
  args?: ToolArgs,
  source: "voice" | "dashboard" = "voice",
): Promise<ToolResult> {
  if (name === "get_farm_status") {
    const result = getState();
    void appendAgentDecision({ tool: name, args, result });
    return result;
  }

  if (name === "get_farm_assessment") {
    const result = assess(getState());
    void appendAgentDecision({ tool: name, args, result });
    return result;
  }

  if (name === "get_farm_history") {
    const minutes = args?.minutes ? Math.min(60, Math.max(1, args.minutes)) : 15;
    const samples = await listSensorHistory(minutes);
    const result: FarmHistory = {
      minutes,
      samples,
      // Oldest -> newest, so trend follows chronological time.
      trend: trend([...samples].reverse()),
    };
    void appendAgentDecision({ tool: name, args, result });
    return result;
  }

  const state = args?.state;
  if (state !== "on" && state !== "off") {
    return { ok: false, error: "state must be 'on' or 'off'" };
  }

  const impact = CONTROL_IMPACT[name][state];

  // Safety layer: high-impact actions require explicit confirmation.
  if (impact === "high" && !args?.confirmed) {
    const refused: ToolResult = {
      ok: false,
      code: "requires_confirmation",
      device: DEVICE_LABEL[name],
      impact,
      message: `${DEVICE_LABEL[name]} on is a high-impact action and needs explicit confirmation.`,
    };
    void appendAgentDecision({ tool: name, args, result: refused, impact });
    return refused;
  }

  const key = CONTROL_KEY[name];
  setState({ [key]: state } as Partial<FarmState>);

  const acknowledged: ToolResult = {
    ok: true,
    device: DEVICE_LABEL[name],
    state,
    impact,
    confirmed: args?.confirmed ?? false,
  };
  void appendEquipmentEvent({
    device: DEVICE_LABEL[name],
    action: state,
    source,
    confirmed: args?.confirmed ?? false,
  });
  void appendAgentDecision({ tool: name, args, result: acknowledged, impact });
  return acknowledged;
}