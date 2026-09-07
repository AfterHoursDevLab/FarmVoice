// Assessment engine unit tests. Build the api first, then run:
//   npm run build -w @farmvoice/api && node apps/api/tests/assess.test.js
const { assess } = require("../dist/assess.js");

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}
const st = (p) => ({ temperatureC: 25, humidityPct: 60, soilMoisturePct: 60, ...p });

console.log("TEST 1 - Normal (25/60/60, all off)");
{
  const a = assess(st({ ac: "off", fan: "off", irrigation: "off" }));
  check("healthy", a.healthy === true, `got ${a.overallSeverity}`);
  check("overallSeverity normal", a.overallSeverity === "normal");
  check("no issues", a.issues.length === 0, `got ${a.issues.length}`);
  check("no recommendations", a.recommendations.length === 0);
  check("equipment snapshot present", a.equipment.ac === "off" && a.equipment.irrigation === "off");
}

console.log("TEST 2 - Temperature (34C, AC off, rest healthy)");
{
  const a = assess(st({ temperatureC: 34, ac: "off", fan: "off", irrigation: "off" }));
  check("temperature_high issue", a.issues.some((i) => i.key === "temperature_high"));
  check("recommends AC on", a.recommendations.some((r) => r.tool === "control_ac" && r.args.state === "on"));
  check("AC impact medium", a.recommendations.find((r) => r.tool === "control_ac")?.impact === "medium");
  check("overallSeverity warning", a.overallSeverity === "warning");
  // AC is medium impact: NOT auto-blocked by backend, prompt enforces confirm
}

console.log("TEST 3 - Irrigation safety (24% soil, irrigation off)");
{
  const a = assess(st({ soilMoisturePct: 24, ac: "off", fan: "off", irrigation: "off" }));
  check("soil_moisture_low issue", a.issues.some((i) => i.key === "soil_moisture_low"));
  const recIrrig = a.recommendations.find((r) => r.tool === "control_irrigation");
  check("recommends irrigation on", !!recIrrig && recIrrig.args.state === "on");
  check("irrigation impact HIGH", recIrrig?.impact === "high");
  check("24% soil -> critical (below 25% critical floor)", a.overallSeverity === "critical", `got ${a.overallSeverity}`);
}

console.log("Severity boundaries (spec: 28 normal, 32 warning, 38 critical)");
{
  const at = (t) => assess(st({ temperatureC: t, ac: "off" })).readingStatus.temperatureC;
  check("28 -> normal", at(28) === "normal", `got ${at(28)}`);
  check("32 -> warning", at(32) === "warning", `got ${at(32)}`);
  check("38 -> critical", at(38) === "critical", `got ${at(38)}`);
  check("critical raises overallSeverity", assess(st({ temperatureC: 38, ac: "off" })).overallSeverity === "critical");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);