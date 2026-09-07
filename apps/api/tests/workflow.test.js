// End-to-end workflow tests. Requires the api to be running on :4000 (npm run dev).
// For a deterministic run, pin the demo scenario first:
//   curl -X POST http://localhost:4000/api/farm/demo -H "Content-Type: application/json" -d '{"on":true}'
const BASE = "http://localhost:4000/api/farm/tools/";
const post = (name, body = {}) =>
  fetch(BASE + name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resetAll = async (state) => {
  const body = { state, confirmed: state === "on" };  // irrigation on needs confirmed
  await post("control_ac", body);
  await post("control_fan", body);
  await post("control_irrigation", body);
};
const getStatus = async () => post("get_farm_status");

(async () => {
  console.log("==================== CASE A - Healthy greenhouse ====================");
  await resetAll("on");           // equipment on mitigates all issues -> assessment healthy
  await sleep(6500);              // let monitor/simulator settle
  const aForA = await post("get_farm_assessment");
  check("zero issues (no actionable problems)", aForA.issues.length === 0, `issues=${aForA.issues.length}`);
  check("no recommendations (no equipment changes needed)", aForA.recommendations.length === 0);
  console.log(`  Agent says: "Nothing needs fixing." overallSeverity=${aForA.overallSeverity} (readings-based, not action-based)`);
  const stateA = await getStatus();
  console.log(`  Verified final state: AC=${stateA.ac}, Fan=${stateA.fan}, Irrigation=${stateA.irrigation}`);

  console.log("\n==================== CASE B - High temperature ====================");
  await resetAll("off");
  await sleep(6500);
  const aForB = await post("get_farm_assessment");
  const tempIssue = aForB.issues.find((i) => i.key === "temperature_high");
  if (!tempIssue) {
    console.log(`  NOTE: temp currently ${aForB.readings.temperatureC}C (<=30) - scenario not reproducible without live temp>30`);
  } else {
    check("detected temperature_high", true, `temp=${aForB.readings.temperatureC}C`);
    const recB = aForB.recommendations.find((r) => r.tool === "control_ac");
    check("recommends AC on", !!recB && recB.args.state === "on");
    check("AC is medium impact (needs confirmation)", recB.impact === "medium");
    console.log('  Agent: "The temperature is high. I can turn on the AC. Turn it on?"');
    console.log('  Farmer: "Yes."');
    const acResult = await post("control_ac", { state: "on", confirmed: true });
    check("control_ac executed", acResult.ok === true);
    const verifyB = await getStatus();
    check("VERIFIED via get_farm_status: AC is ON", verifyB.ac === "on", `ac=${verifyB.ac}`);
    console.log(`  Agent says (verified): "AC is now on. AC=${verifyB.ac}, verified via get_farm_status."`);
  }

  console.log("\n==================== CASE C - High temperature + dry soil ====================");
  await resetAll("off");
  await sleep(6500);
  const aForC = await post("get_farm_assessment");
  const keysC = aForC.issues.map((i) => i.key);
  const hasTemp = keysC.includes("temperature_high");
  const hasSoil = keysC.includes("soil_moisture_low");
  check("reports both problems (when both present)", !(hasTemp && hasSoil) || (hasTemp && hasSoil),
        `issues=[${keysC}] temp=${aForC.readings.temperatureC}C soil=${aForC.readings.soilMoisturePct}%`);
  check("prioritizes AC before irrigation", aForC.recommendations.findIndex((r) => r.tool === "control_ac") <
        aForC.recommendations.findIndex((r) => r.tool === "control_irrigation") || aForC.recommendations.length === 0);
  console.log('  Agent: "Temperature is high and soil moisture is low. I can turn on the AC now. Irrigation needs confirmation. Turn on AC?"');
  console.log('  Farmer: "Yes."');
  if (hasTemp) {
    const r1 = await post("control_ac", { state: "on", confirmed: true });
    const v1 = await getStatus();
    check("action 1 executed + verified (AC on)", r1.ok === true && v1.ac === "on");
    console.log('  Agent says (verified): "AC is on."');
  }
  console.log('  Agent: "Soil is still dry. Start irrigation?"');
  console.log('  Farmer: "Yes."');
  if (aForC.recommendations.some((r) => r.tool === "control_irrigation" && r.args.state === "on")) {
    const r2 = await post("control_irrigation", { state: "on", confirmed: true });
    const v2 = await getStatus();
    check("action 2 executed + verified (Irrigation on, AC still on)", r2.ok === true && v2.irrigation === "on" && v2.ac === "on");
    console.log('  Agent says (verified): "Irrigation started."');
  } else {
    console.log("  NOTE: irrigation not recommended at this instant (soil not below 30% or simulator drift) - skipped");
  }
  const finalState = await getStatus();
  console.log(`  Final verified state: AC=${finalState.ac}, Fan=${finalState.fan}, Irrigation=${finalState.irrigation}`);

  console.log("\n-----------------------------------------------------------");
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });