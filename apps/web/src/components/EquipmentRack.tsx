"use client";

import { ControlArgs, FarmState } from "@farmvoice/shared";
import { api } from "../lib/api";

const DEVICE_NAME: Record<string, string> = {
  ac: "AC",
  fan: "Fan",
  irrigation: "Irrigation",
};

export function EquipmentRack({ state }: { state: FarmState }) {
  const toggle = async (key: "ac" | "fan" | "irrigation") => {
    const args: ControlArgs = {
      state: state[key] === "on" ? "off" : "on",
      confirmed: true,
    };
    await api.runTool(`control_${key}`, args, "dashboard");
  };

  return (
    <section className="card">
      <h3 className="sub">Equipment</h3>
      <div className="equipment">
        {(["ac", "fan", "irrigation"] as const).map((key) => {
          const on = state[key] === "on";
          return (
            <div key={key} className="equip-card">
              <div className="equip-name">{DEVICE_NAME[key]}</div>
              <div className={`equip-state ${on ? "on" : "off"}`}>
                {on ? "ON" : "OFF"}
              </div>
              <button
                type="button"
                className={on ? "btn-on" : "btn-off"}
                onClick={() => toggle(key)}
              >
                {on ? "Turn off" : "Turn on"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
