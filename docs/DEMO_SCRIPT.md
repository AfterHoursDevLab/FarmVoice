# Hero Demo — Script & Capture Guide

Record ~2 minutes. Capture **both** the browser window (dashboard + voice panel) and the audio.

## Before you record

1. Start the app:
   ```bash
   npm run dev
   ```
2. Open **http://localhost:3000** and allow the microphone.
3. Pin the deterministic **Critical** scenario:
   ```bash
   curl -X POST http://localhost:4000/api/farm/demo -H "Content-Type: application/json" -d '{"on":true}'
   ```
   This sets **34 °C / 81 % / 24 %, AC/Fan/Irrigation OFF** and freezes the simulator so nothing drifts.

> Tip: do this right before pressing record so the dashboard shows **Farm Health: Critical** with both issues.

## Optional on-screen title (first ~10 s overlay)

> "Farmers can't constantly monitor greenhouse conditions. FarmVoice lets them talk to their greenhouse, understand problems, and safely take action."

## The script

| Time   | You say / do                              | Expected on screen / spoken              |
| ------ | ----------------------------------------- | ---------------------------------------- |
| 00:00  | *(Start)* Click **Talk**                  | ● Listening indicator                      |
| 00:05  | **"Check my greenhouse."**                | Agent reads live state, worst-first: high temperature + dry soil |
| 00:30  | **"Fix my greenhouse."**                  | Recommends AC + irrigation, asks to confirm |
| 00:45  | **"Yes."**                                | **AC → ON**, verified from live state     |
| 01:00  | **"Yes."** (to irrigation)                | **Irrigation → ON**, verified            |
| 01:15  | *(listen)*                                | Final summary: "AC is on. Irrigation is running." |
| 01:30  | *(camera on dashboard)*                   | Show **issues cleared** + equipment row: **AC ON, Irrigation ON**; event log rows: `AC turned ON · FarmVoice · Confirmed · Verified`, `Irrigation turned ON · FarmVoice · Confirmed · Verified`. (Farm Health badge still reads **Critical** — demo readings are frozen at 34 °C / 24 %, and the badge reports the measured value, not the fix.) |
| ~01:45 | *(fade / end)*                            | —                                      |

## Proof points visible in the recording

- ☐ AssemblyAI realtime voice (listening → speak)
- ☐ Farm assessment (34 °C / 24 % called out)
- ☐ AI reasoning (worst-first explanation)
- ☐ Safety confirmation ("needs your confirmation")
- ☐ Tool execution (AC on, Irrigation on)
- ☐ State verification (agent re-checks get_farm_status)
- ☐ Dashboard update (issues resolve, equipment ON, event log rows — badge still reports the frozen 34 °C / 24 % reading)

## Where the media goes

- Video → `docs/media/hero-demo.mp4` (or `.webm`)
- Screenshots → `docs/media/` (e.g. `critical.png`, `ac-on.png`, `resolved.png`)
