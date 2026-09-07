import { DEFAULT_FARM_STATE, FarmState } from "@farmvoice/shared";
import { emitEvent } from "./events";

let state: FarmState = {
  ...DEFAULT_FARM_STATE,
  updatedAt: new Date().toISOString(),
};

/** When true, the simulator stops drifting so demo recordings are predictable. */
let paused = false;

export function getState(): FarmState {
  return state;
}

export function isSimulatorPaused(): boolean {
  return paused;
}

export function setSimulatorPaused(v: boolean): boolean {
  paused = v;
  return paused;
}

export function setState(patch: Partial<FarmState>): FarmState {
  state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  emitEvent({ type: "state", state });
  return state;
}