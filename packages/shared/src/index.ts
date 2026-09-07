export type EquipmentState = "on" | "off";

export interface FarmState {
  temperatureC: number;
  humidityPct: number;
  soilMoisturePct: number;
  ac: EquipmentState;
  fan: EquipmentState;
  irrigation: EquipmentState;
  updatedAt: string;
}

export const DEFAULT_FARM_STATE: FarmState = {
  temperatureC: 34,
  humidityPct: 81,
  soilMoisturePct: 28,
  ac: "off",
  fan: "off",
  irrigation: "off",
  updatedAt: new Date().toISOString(),
};

export type Impact = "low" | "medium" | "high";

export interface Issue {
  key: string;
  severity: "info" | "warning" | "critical";
  message: string;
  /** Short headline for the UI, e.g. "High temperature". */
  title?: string;
  /** Human-readable comparison, e.g. "34°C > 30°C". */
  label?: string;
}

export interface Recommendation {
  tool: "control_ac" | "control_fan" | "control_irrigation";
  args: ControlArgs;
  impact: Impact;
  reason: string;
  /** Structured reasoning for the UI: which metric triggered it, its detected
   *  value, the threshold it violated, and whether that threshold is a target
   *  or a critical cutoff. */
  metric?: "temperatureC" | "humidityPct" | "soilMoisturePct";
  detected?: number;
  threshold?: number;
  thresholdKind?: "target" | "critical";
}

export interface FarmAssessment {
  timestamp: string;
  readings: Pick<FarmState, "temperatureC" | "humidityPct" | "soilMoisturePct">;
  /** On/off state of every device at the same instant as the readings, so the
   *  assessment is a single self-consistent snapshot. Never stale vs. a later
   *  get_farm_status. */
  equipment: Pick<FarmState, "ac" | "fan" | "irrigation">;
  /** NORMAL / WARNING / CRITICAL classification of each individual reading. */
  readingStatus: {
    temperatureC: Severity;
    humidityPct: Severity;
    soilMoisturePct: Severity;
  };
  /** Overall farm severity: critical if any reading is critical, else warning if any is warning, else normal. */
  overallSeverity: Severity;
  healthy: boolean;
  issues: Issue[];
  recommendations: Recommendation[];
}

export type Severity = "normal" | "warning" | "critical";

/** One persisted sensor sample, newest first. Used for historical reasoning. */
export interface SensorSample {
  timestamp: string;
  temperatureC: number;
  humidityPct: number;
  soilMoisturePct: number;
}

export interface MetricTrend {
  first: number;
  last: number;
  min: number;
  max: number;
  delta: number;
}

/** Result of get_farm_history: recent samples plus per-reading trends. */
export interface FarmHistory {
  minutes: number;
  samples: SensorSample[];
  trend: {
    temperatureC: MetricTrend;
    humidityPct: MetricTrend;
    soilMoisturePct: MetricTrend;
  };
}

export interface FarmAlert {
  id?: number;
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  issueKeys: string[];
  createdAt: string;
}

export interface EquipmentEvent {
  id?: number;
  occurredAt: string;
  device: string;
  action: EquipmentState;
  source: "voice" | "dashboard";
  confirmed?: boolean;
}

export type FarmToolName =
  | "get_farm_status"
  | "get_farm_assessment"
  | "get_farm_history"
  | "control_ac"
  | "control_fan"
  | "control_irrigation";

export interface ControlArgs {
  state: EquipmentState;
  /** Authorize a high-impact action. Required to turn irrigation ON. */
  confirmed?: boolean;
}

/**
 * AssemblyAI Voice Agent function-tool definition.
 * Registered client-side in session.tools.
 */
export interface ToolDefinition {
  type: "function";
  name: FarmToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const SYSTEM_PROMPT = `You are FarmVoice, the voice assistant for Greenhouse #1 in the FarmVoice smart-farm demo.

Begin each session by waiting quietly for the farmer's first request. Do not run any tools or report any readings before the farmer has asked. Wait for the farmer's request, then act accordingly.

Tools:
- get_farm_status: current readings + on/off state of AC, fan, irrigation.
- get_farm_assessment: readings, per-reading severity (NORMAL/WARNING/CRITICAL), overall severity, the on/off state of every device at that same instant, detected issues, and recommended actions with impact.
- get_farm_history: recent sensor history (default last 15 minutes, pass minutes for a specific window) plus a per-metric summary (first/last/min/max + delta). Use it whenever the farmer asks "why", "what happened", or about trends over time.
- control_ac / control_fan / control_irrigation: turn equipment on or off.

Status checks:
- Simple questions ("what's happening", "check the greenhouse", "is everything okay", "how is my farm") -> call get_farm_status and read out the readings.
- Diagnosis ("what's wrong", "is anything wrong", "what should I do", "fix everything") -> call get_farm_assessment and follow the diagnosis flow below.

Severity & tone:
- The assessment marks each reading NORMAL, WARNING, or CRITICAL and gives an overall severity.
- overallSeverity NORMAL -> calm, brief: "Everything looks fine."
- overallSeverity WARNING -> concerned but calm: lead with the issue and the fix.
- overallSeverity CRITICAL -> urgent and direct. State the problem first, then the recommended action immediately. Do not pad with small talk.

Diagnosis flow (assessment-based):
1. Call get_farm_assessment.
2. Read out the readings (temperature in degrees C, humidity and soil moisture in percent), the equipment states, and the overall severity.
3. Describe each problem and recommend the action, e.g. "Temperature is 34°C, which is critical. The AC is off. I can turn it on. Soil moisture is low; irrigation would need your OK."
4. Get confirmation before executing medium/high-impact actions.
5. After executing any action, call get_farm_status to confirm the resulting state before describing it.

Synchronization:
- Readings drift slightly every few seconds, so use the numbers from the most recent tool result when speaking. Never mix values from an older assessment into a newer report.
- get_farm_assessment includes the equipment state captured at the same instant as its readings - trust it as a consistent snapshot instead of assuming equipment state from memory.

Historical reasoning:
- For "why is it hot", "why does it keep getting hot", "what happened five minutes ago", "why is my greenhouse getting hotter": call get_farm_history (pass minutes for the window the farmer mentions, e.g. 10 for "last ten minutes").
- Frame it as a change over time using the trend: first vs last value and the delta, plus the equipment state. e.g. "Temperature rose from 27°C to 34°C over the last 10 minutes (about +7°C) while the AC stayed off - cooling has been insufficient, so I recommend turning the AC on."
- Pick 2-3 points in time for clarity when useful ("about 10 minutes ago it was 27°C, 5 minutes ago 31°C, and now it's 34°C").
- Never invent history that is not in the tool result; derive every number from the trend/samples returned.

"Fix my greenhouse" flow (hero demo):
1. Call get_farm_assessment (readings + equipment + issues + recommendations in one snapshot).
2. If there are no issues, reply "Nothing needs fixing." and stop - do not touch any equipment.
3. Otherwise summarize the problems, most severe first. e.g. "Temperature is high and soil moisture is low."
4. Handle actions in priority order; low-impact first, then medium/high:
   - Low-impact actions (fan on or off): execute them right away WITHOUT asking for confirmation, even when the farm shows WARNING.
   - Medium/high-impact (AC, irrigation): state that they need confirmation and ask for ONE at a time. e.g. "I can turn on the AC now. Irrigation needs confirmation. Turn on AC?"
5. Only ever propose/execute actions that appear in the assessment's recommendations. Never invent extra actions (for example, do not suggest the fan unless a humidity issue or another reason for the fan is actually present and recommended). If a device is not recommended, leave it out entirely.
5. Wait for the farmer's yes before executing each confirmed action.
6. VERIFY EVERY ACTION: immediately after executing any control tool, call get_farm_status and compare the reported device state against what you intended.
7. Confirm only with the VERIFIED state: e.g. get_farm_status reports ac: on -> say "AC is on." Never say "Done" without checking get_farm_status.
8. Move to the next problem. e.g. "AC is on. Soil is still dry. Start irrigation?" -> wait -> execute -> verify -> "Irrigation started."
9. Finish with a one-line summary of the verified final state ("AC is on, irrigation is running - the greenhouse is being stabilized.").

Verify after every action (mandatory rule):
- Any time you execute control_ac, control_fan, or control_irrigation, you MUST follow it with get_farm_status and confirm the actual state before telling the farmer anything.
- Report the VERIFIED state from get_farm_status (e.g. "AC is now on."). Never assume success from memory or intent.
- If the verified state does not match the intent, describe what you observed and the next step instead of claiming success.

Safety rules:
- The fan is low-impact: turn it on or off immediately WITHOUT confirmation, regardless of severity. Never ask the farmer before executing the fan.
- Medium/high-impact actions (AC, irrigation) must be confirmed with the farmer before executing - ask, then wait for yes.
- Turning irrigation ON is high-impact: the backend rejects it unless you pass confirmed: true. Only set confirmed: true once the farmer has explicitly authorized that specific action.
- If the farmer says "don't turn irrigation on" (or similar refusal), skip that action and never execute it.
- "Turn everything off" -> turn all three devices off (irrigation off is low-impact and safe). No confirmation needed.
- Never invent readings or values that did not come from a tool result.
- Keep replies short and natural. Never read out a raw JSON object.`;

export const FARM_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "get_farm_status",
    description:
      "Get the current greenhouse status: temperature in degrees C, humidity %, soil moisture %, and the on/off state of the AC, fan, and irrigation. Call this for any simple question about the greenhouse or its equipment.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "get_farm_assessment",
    description:
      "Get a full health assessment of the greenhouse: current readings, per-reading severity (NORMAL/WARNING/CRITICAL), overall severity, the on/off state of every device captured at the same instant, any detected issues, and recommended actions with their impact level. Call this when asked what's wrong with the greenhouse, whether everything is okay, or before recommending anything.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "get_farm_history",
    description:
      "Get recent sensor history for the greenhouse (temperature, humidity, soil moisture) plus a per-metric summary with first/last/min/max and delta. Prefer it for trends over time. Call this when the farmer asks about causes or what happened over time (e.g. 'why does it keep getting hot', 'why is my greenhouse getting hotter', 'what happened five minutes ago') - pass minutes for the specific window they mention.",
    parameters: {
      type: "object",
      properties: {
        minutes: {
          type: "number",
          description: "How far back to look, in minutes. Defaults to 15.",
        },
      },
    },
  },
  {
    type: "function",
    name: "control_ac",
    description:
      "Turn the greenhouse AC on or off. Use when the farmer asks to turn the air conditioner (or AC) on or off, or to lower the temperature. After the action, call get_farm_status to verify the actual state before confirming.",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "Desired AC state",
          enum: ["on", "off"],
        },
      },
      required: ["state"],
    },
  },
  {
    type: "function",
    name: "control_fan",
    description:
      "Turn the greenhouse ventilation fan on or off. Low-impact action that may be used without confirmation. After the action, call get_farm_status to verify the actual state before confirming.",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "Desired fan state",
          enum: ["on", "off"],
        },
      },
      required: ["state"],
    },
  },
  {
    type: "function",
    name: "control_irrigation",
    description:
      "Turn the greenhouse irrigation system on or off. Turning it ON is high-impact - the backend requires confirmed: true. Only pass confirmed: true when the farmer has explicitly authorized it. After the action, call get_farm_status to verify the actual state before confirming.",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "Desired irrigation state",
          enum: ["on", "off"],
        },
        confirmed: {
          type: "boolean",
          description:
            "Explicit authorization. Required to turn irrigation ON.",
        },
      },
      required: ["state"],
    },
  },
];

export interface EquipmentDefinition {
  key: "ac" | "fan" | "irrigation";
  label: string;
}

export const EQUIPMENT: EquipmentDefinition[] = [
  { key: "ac", label: "AC" },
  { key: "fan", label: "Fan" },
  { key: "irrigation", label: "Irrigation" },
];