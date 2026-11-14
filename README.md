# Junior Astronaut Mission Trainer

A browser game for children aged 7 to 12. You run a Moon base for ten days and keep three astronauts safe from **real solar storms**, replayed from NASA's space weather records.

**Play it:** https://heartfirej.github.io/HackAthlone_Build-a-Junior-Astronaut-Mission-Trainer/

No download, no account. Works on a laptop and on a phone.

Built at HackAthlone 2026 (TUS Athlone, Ireland) for the NASA Space Apps Challenge 2026, challenge *Build a Junior Astronaut Mission Trainer*.

> Status: work in progress during the hackathon weekend. The name, the artwork and the balance numbers are not final.

## How the game works

- Each turn is one day. The supply ship lands at the end of day 10.
- The base has three supplies: **power, oxygen and food**. It uses some of each every day.
- You have **three astronauts and four jobs**: fix the solar panels, run the oxygen machine, grow food, or explore outside for science. Someone can also rest. There are always more jobs than people, so every day something has to wait.
- Each morning Mission Control sends a **storm forecast**: low, medium or high. The forecast is sometimes wrong, as real forecasts are.
- You can send everyone to the **storm shelter**. They are safe, but nobody works that day and the base still uses its supplies.
- If a solar storm arrives, people outside are hurt the most, people inside the base a little, and people in the shelter not at all.
- Exploring outside needs oxygen for the space suit. With an empty tank, nobody can go out.
- Finishing the mission earns one star. More science earns up to three.

The trade-off the game teaches: you cannot know for certain when the Sun will be dangerous, and hiding from it has a real cost. Shelter too rarely and the crew gets sick. Shelter too often and the base runs out of air and food.

## Real NASA data

The storms are not random. Each mission replays ten real days of space weather from NASA's **Space Weather Database Of Notifications, Knowledge, Information (DONKI)**: https://ccmc.gsfc.nasa.gov/tools/DONKI/

| Mission | Real dates | What happened |
|---|---|---|
| The Quiet Sun | 1–10 December 2019 | Solar minimum. DONKI lists no solar flares for these ten days. |
| September Surprise | 3–12 September 2017 | An X9.3 flare on 6 September, and solar particle events on four days. |
| The Great May Storm | 6–15 May 2024 | Many X-class flares, three days with particle events, and a geomagnetic storm that reached Kp 9. |

How the records drive the game:

| In the game | From the real data | Simplified for the game |
|---|---|---|
| Is there a storm today? | DONKI lists each solar energetic particle event with the time a spacecraft near Earth (GOES, SOHO or ACE) first measured it. Model predictions and the distant STEREO A spacecraft are left out. | Each event makes one storm day: the day it started. Real particle events can last several days, so a "calm day" in the game only means that no new event started. |
| Is the storm severe? | Protons above 100 MeV were measured. | Only two levels. |
| Morning forecast | The class of the strongest solar flare on the day before. | X-class gives "high", M-class gives "medium", anything weaker gives "low". Real forecasting uses far more than this. |
| Radio link down | Nothing. | A game rule: no forecast arrives on the morning after a storm. |
| Supplies and health | Nothing. | Made-up units. |

The game uses **saved records, not live data**, and says so on screen. The file `src/data/scenarios.json` is produced by `scripts/fetch-donki.mjs`, which downloads the records from the DONKI API. Run `npm run data` to regenerate it and check it against NASA's database. In the game, every storm links to its DONKI record, and every day shows its real date.

The panel "What is real in this game?" in the game tells players the same thing in plain language.

## Run it yourself

Needs Node.js 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## How the code is organised

- `src/game/` holds the rules as plain TypeScript, with no React. The whole game is one pure function, `resolveDay(state, plan)`, which returns the next state and a report of what happened. There is no randomness, so every rule can be tested.
- `src/game/scenario.ts` turns DONKI records into "storm today", "forecast" and "radio down".
- `src/data/` holds the saved NASA records and the text for each mission.
- `src/components/` holds the screens. They only display things and report clicks.
- The tests in `src/game/*.test.ts` also guard the design. For example, they check that hiding in the shelter every day, resting every day, or doing only science all fail on every mission, so no choice is free.

Built with TypeScript, React, Vite and Vitest. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

## Use of AI

AI tools were used heavily in this project, and this section says where.

- **Code and tests:** written almost entirely by an AI coding assistant (Anthropic's Claude, through Claude Code), directed, reviewed and tested by the author. The commit history records this: AI-written commits carry a `Co-Authored-By` line.
- **Code review:** a second AI model (OpenAI Codex) was asked to review the rules for bugs.
- **Game design:** the author chose the challenge and made the design decisions. The AI assistant proposed options and wrote them up.
- **Text in the game:** drafted by the AI assistant, checked by the author.
- **Images:** no AI-generated images are used.
- **Working notes:** `AGENTS.md` and the files in `docs/` are the instructions and notes the author and the AI assistant worked from. They are written in Chinese.

No NASA logos or other NASA branding are used anywhere in the project.

## Sources and credits

- NASA DONKI space weather database, Community Coordinated Modeling Center, NASA Goddard: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA, "Scientists and Engineers Evaluate Orion Radiation Protection Plan", for the storm shelter fact in the mission report: https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/
- Trinity College Dublin, "New radio telescope in Birr detects huge solar storms", for I-LOFAR and the radio burst of 10 September 2017: https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/
- NASA, "Sun Erupts With Significant Flare", for the X9.3 flare of 6 September 2017: https://www.nasa.gov/solar-system/sun-erupts-with-significant-flare/
- NASA, "How NASA Tracked the Most Intense Solar Storm in Decades", for the May 2024 storm: https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/
- NASA, "Solar Cycle 25 Is Here", for the solar minimum of December 2019: https://www.nasa.gov/news-release/solar-cycle-25-is-here-nasa-noaa-scientists-explain-what-that-means/
- RTÉ News, "Northern Lights to be visible across Ireland this evening", for the aurora over Ireland in May 2024: https://www.rte.ie/news/ireland/2024/0511/1448552-northern-lights
- Challenge statement: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
- Open-source software: React, Vite, Vitest, TypeScript, oxlint.

The Moon base, the crew and "Mission Control, Athlone" are fictional. NASA does not endorse this project.
