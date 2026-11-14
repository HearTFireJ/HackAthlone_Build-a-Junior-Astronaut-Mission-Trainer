# Junior Astronaut Mission Trainer

A browser game for children aged 7 to 12. You are the commander of a Moon outpost. Your crew has missions to do, there is never enough power for everything, and the Sun does exactly what the **real Sun** did on those dates, replayed from NASA's space weather records.

**Play it:** https://heartfirej.github.io/HackAthlone_Build-a-Junior-Astronaut-Mission-Trainer/

No download, no account. Made for a laptop screen; it also works on a phone.

Built at HackAthlone 2026 (TUS Athlone, Ireland) for the NASA Space Apps Challenge 2026, challenge *Build a Junior Astronaut Mission Trainer*.

> Status: work in progress during the hackathon weekend. The game's name, the crew's names, the artwork and the balance numbers are not final.

## How the game works

Each turn is one day, and a tour lasts ten days. Then the next crew arrives and you see how you did.

You see the base from above. In the morning you give the orders: click the ⚡ switch under a module to give it power, click an astronaut and then the place where they should work. Then you press **Start the day** and watch it play out. The crew walks to work, puts on spacesuits to go outside, waters the plants, welds the telescope together, drives the rover away. If a flare alert comes in, the picture stops and waits for your decision. If a real storm arrives, you see it sweep over the base and hit whoever is not under cover.

Real storm particles are far too small to see. The game draws them so that you can watch the storm arrive.

**Every morning you plan the day:**

1. **Share out the power.** The solar panels make about 7 units a day. Running everything would take 10. You choose which modules get power:

   | Module | Power | What it does |
   |---|---|---|
   | Life Support | 2 | Makes air to breathe |
   | Greenhouse | 2 | Grow-lights: the plants make food |
   | Radio Dish | 1 | Storm alerts today, the Sun report tomorrow, calls home |
   | Sun Telescope | 1 | Tells you whether a cloud of gas left the Sun with a flare |
   | Lab | 2 | Lets the crew do research |
   | Rover Bay | 2 | Charges the rover for a trip |

2. **Give each astronaut a job.** Tend the plants, do research, build the radio telescope outside, repair the solar panels, drive the rover, rest, go to the sick bay, or call home. Each astronaut has health, mood and hunger. Each one loves a different job and does it better. Some are friends, and two get on each other's nerves. Three days of work in a row makes anyone tired, and then only a day off helps.

3. **Work on your four missions.** They are why the crew is there, and each one changes the base when it is finished:

   | Mission | How | What it gives you |
   |---|---|---|
   | Find water ice | Three rover trips to a dark crater | Life Support makes much more air |
   | Moon-soil shield | Research in the Lab | Storms hurt less inside the base |
   | Radio telescope | Build it outside, piece by piece | The whole crew cheers up |
   | Watch the Sun | Run the Sun Telescope for 5 days | Alerts always say if a cloud left the Sun |

**Most mornings something happens**: a pea-sized rock hits the Greenhouse, a school wants to call, a supply pod lands far away, someone misses home, the rover gets stuck in the dust. Every card is a choice between two answers.

**When the Sun fires a big flare, Mission Control calls** (if the Radio Dish has power). You have three answers:

- **Carry on.** All the work gets done. If a particle storm follows, people outside are hurt badly and people inside a little.
- **Call the outside crew in.** They get half their work done at most, and a rover trip has to start again.
- **Everyone to the storm shelter.** Nobody is hurt, and everyone gets half a day's work done at most. If no storm comes, the crew's mood drops: a day squeezed into the shelter for nothing is no fun.

Most flares bring no storm. The game then tells you what really happened that day, with a link to NASA's record.

At the end you earn up to five stars: one for each finished mission, and one for handing the next crew a base with air, food and a healthy, happy crew. Nobody dies in this game. If things go very wrong the crew flies home early and you can try again.

### The decisions the challenge asks for

The challenge names five kinds of decision. This is where each one is in the game:

| Challenge | In the game |
|---|---|
| Life support | Life Support needs 2 power every day or the air runs down. Finding ice makes it much stronger, but the three ice trips take the rover and an astronaut away for five days. |
| Radiation protection | Every flare alert: keep working or take cover. The Moon-soil shield costs Lab power and research days that could have gone to anything else. |
| Power budgeting | Six modules, never enough power. Storms wear the panels down and dust settles on them, and someone has to go outside to fix that. |
| Food production | The Greenhouse needs power and grows more if someone tends it. A storm spoils part of the day's crop unless the shield is built. |
| Communication | The Radio Dish costs power. With it off, no flare alert reaches you today and no Sun report tomorrow. The Sun report is always about yesterday. The game does not model the real signal delay to the Moon (a little over a second each way). |

## Real NASA data

The flares and storms are not random. Each mission replays ten real days of space weather from NASA's **Space Weather Database Of Notifications, Knowledge, Information (DONKI)**: https://ccmc.gsfc.nasa.gov/tools/DONKI/

| Mission | Real dates | In the saved records |
|---|---|---|
| The Quiet Sun | 1–10 December 2019 | Solar minimum. No solar flares at all for these ten days. |
| September Surprise | 3–12 September 2017 | 35 flares, including an X9.3. Five alert days, three particle storms. |
| The Great May Storm | 6–15 May 2024 | 118 flares. An alert on every one of the ten days, three particle storms. |

How the records drive the game:

| In the game | From the real data | Made simple for the game |
|---|---|---|
| Flare alert | The biggest solar flare of that day, with its class and peak time. | Mission Control only calls about flares of class M5 or bigger. If a storm arrived that day, the alert shows the biggest such flare that peaked before the storm. |
| "A cloud of gas left the Sun" | DONKI links each flare to the events that came with it. A linked coronal mass ejection (CME) is the cloud. | Only "a cloud" or "no cloud listed". No linked CME in the record does not prove there was none, and the game says so. You need the Sun Telescope to see the clue. |
| Is there a particle storm today? | DONKI lists each solar energetic particle event with the time a spacecraft near Earth (GOES, SOHO or ACE) first measured it. Model predictions and the distant STEREO A spacecraft are left out. | Records less than 12 hours apart count as one storm. A storm lasts one day in the game: the day it started. Real particle storms can go on for several days, so the game says "no new storm today", not "a calm day". The measurements were made near Earth; the game pretends the same storms reached the Moon base. |
| Is the storm severe? | Protons above 100 MeV were measured. | Only two levels. |
| Morning Sun report | The number of flares the day before, and the class of the biggest. | Summed up as quiet, active or very active. |
| What a storm does | Nothing. | Game rules: how much it hurts people, how much it wears the solar panels, how much crop it spoils. Scientists are still finding out what space radiation does to plants. |
| Power, air, food, health, mood | Nothing. | Made-up units. |

Across the two stormy missions there are 15 alert days. On 13 of them the alert flare has a linked cloud, and 6 of those 13 days had a particle storm. Neither of the 2 days with no cloud listed had one. That is the pattern a player can learn, and it matches what NASA says: scientists increasingly think the clouds drive the most dangerous particle storms, only a small fraction of flares and clouds produce them, and nobody can yet tell which ones will. Two tests in `src/game/outpost.test.ts` check this pattern against the saved records, so the hint in the game cannot drift away from the data.

The game uses **saved records, not live data**, and says so on screen. The file `src/data/scenarios.json` is produced by `scripts/fetch-donki.mjs`, which downloads the records from the DONKI API. Run `npm run data` to regenerate it and check it against NASA's database. In the game, every flare and every storm links to its DONKI record, and every day shows its real date.

The short "Real life" lines in the game (what a solar flare is, why astronauts look for ice, how a storm shelter works, why Moon dust is a problem, and so on) each link to the page they were checked against. They are all in `src/data/facts.ts`.

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

- `src/game/` holds the rules as plain TypeScript, with no React.
  - `outpost.ts` is the rules engine. One function, `resolveDay(state, scenario, plan, response)`, takes the day's plan and returns the next state and a report of what happened. The only dice are for the morning event cards, and they are seeded, so every rule can be tested.
  - `content.ts` holds the modules, jobs, crew and missions. `events.ts` holds the morning event cards.
  - `weather.ts` describes the real records the game reads.
- `src/data/` holds the saved NASA records, the text for each mission and the sourced facts.
- `src/scene/` holds the moving picture of the base, drawn on a canvas. `script.ts` turns the day's result into a list of timed cues (who walks where, what pops up, when the storm sweeps in). `world.ts` plays those cues and moves everyone. `draw.ts` paints. None of it changes the rules: the result of the day is worked out first, and the picture only shows it.
- `src/components/` holds the screens. They only display things and report clicks.
- The tests in `src/scene/script.test.ts` check that the film of a day ends on exactly the numbers the rules worked out, and that the storm is shown hitting exactly the people the rules say were hurt.
- The tests in `src/game/outpost.test.ts` also guard the design. For example, they check that a commander who keeps everyone comfortable and ignores the missions earns at most one star, and that taking cover always costs some work.

Built with TypeScript, React, Vite and Vitest. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

## Use of AI

AI tools were used heavily in this project, and this section says where.

- **Code and tests:** written almost entirely by an AI coding assistant (Anthropic's Claude, through Claude Code), directed, reviewed and play-tested by the author. The commit history records this: AI-written commits carry a `Co-Authored-By` line.
- **Code review:** a second AI model (OpenAI Codex) was asked to review the rules for bugs and loopholes, once for each version of the game. It only read the code. Its findings were checked and fixed by the first assistant.
- **Game design:** the challenge sets the frame: an outpost, the five kinds of decision, real NASA data. The author decided what kind of game it is: an outpost to run, with a crew that has missions, moods and friendships, and with no deaths. The author threw away the first version after playing it. The AI assistant proposed the details (modules, numbers, event cards) and wrote them up.
- **Research:** the AI assistant searched NASA's pages for the "Real life" facts and recorded a quote and a link for each one.
- **Text in the game:** drafted by the AI assistant.
- **Images:** no AI-generated images are used. The game is drawn with CSS and emoji.
- **Working notes:** while building, the author and the AI assistant kept their instructions and design notes in Chinese. Those files are not part of this repository.

No NASA logos or other NASA branding are used anywhere in the project.

## Sources and credits

- NASA DONKI space weather database, Community Coordinated Modeling Center, NASA Goddard: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA Science, "How NASA Will Protect Astronauts From Space Radiation at the Moon", for the Moon-soil shield, the link between clouds and particle storms, and how hard storms are to predict: https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/
- NASA Science, "Moon Water and Ices": https://science.nasa.gov/moon/moon-water-and-ices/
- NASA Science, "Solar Storms and Flares": https://science.nasa.gov/sun/solar-storms-and-flares/
- NASA Solar Dynamics Observatory, "SDO & Space Weather": https://sdo.gsfc.nasa.gov/mission/spaceweather.php
- NASA, "Orion Crew Systems", for the storm shelter: https://www.nasa.gov/reference/crew-systems/
- NASA Science, "CS-3 Science Payloads", for the LuSEE-Night radio telescope: https://science.nasa.gov/lunar-science/clps-deliveries/cs-3/
- NASA, "Dust: An Out-of-This World Problem": https://www.nasa.gov/humans-in-space/dust-an-out-of-this-world-problem/
- NASA, "Isolation: What Can We Learn From the Experiences of NASA Astronauts?": https://www.nasa.gov/humans-in-space/isolation-what-can-we-learn-from-the-experiences-of-nasa-astronauts/
- NASA, "5 Hazards of Human Spaceflight": https://www.nasa.gov/hrp/hazards/
- NASA, "Shrinking Moon May Be Generating Moonquakes": https://www.nasa.gov/news-release/shrinking-moon-may-be-generating-moonquakes/
- NASA, "Growing Plants in Space": https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/
- NASA Science, "Shadows near the Moon's South Pole": https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/
- NASA, "NASA Plans to Assign Missions for Two Future Artemis Cargo Landers": https://www.nasa.gov/news-release/nasa-plans-to-assign-missions-for-two-future-artemis-cargo-landers/
- NASA, "NASA, Japan Advance Space Cooperation, Sign Agreement for Lunar Rover": https://www.nasa.gov/news-release/nasa-japan-advance-space-cooperation-sign-agreement-for-lunar-rover/
- NASA, "Sun Erupts With Significant Flare", for the X9.3 flare of 6 September 2017: https://www.nasa.gov/solar-system/sun-erupts-with-significant-flare/
- Trinity College Dublin, "New radio telescope in Birr detects huge solar storms", for I-LOFAR and the radio burst of 10 September 2017: https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/
- NASA, "How NASA Tracked the Most Intense Solar Storm in Decades", for the May 2024 storm: https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/
- NASA, "Solar Cycle 25 Is Here", for the solar minimum of December 2019: https://www.nasa.gov/news-release/solar-cycle-25-is-here-nasa-noaa-scientists-explain-what-that-means/
- RTÉ News, "Northern Lights to be visible across Ireland this evening", for the aurora over Ireland in May 2024: https://www.rte.ie/news/ireland/2024/0511/1448552-northern-lights
- Challenge statement: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
- Open-source software: React, Vite, Vitest, TypeScript, oxlint.

The outpost, the crew, the missions, the morning event cards and "Mission Control, Athlone" are fictional. NASA does not endorse this project.
