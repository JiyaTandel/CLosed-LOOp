# CLosed LOOp

**NASA Space Apps Challenge 2026 | Local event: Surat | Challenge: Junior Astronaut Mission Trainer**

**Play it here:** https://jiyatandel.github.io/CLosed-LOOp/

CLosed LOOp is a realistic, turn-based, single-player lunar outpost game for school-age space enthusiasts. You are mission control for four astronauts living on the Moon. Every day you decide how to spend their working hours, which systems get power first, and whether the crew should shelter from radiation. The goal is to keep the crew alive until the end of the mission.

The game is strict on purpose: one bad decision can end the mission. You can restart at any time, and each restart shuffles event timing slightly, so you learn the situation without memorising it.

## What you manage
Power, oxygen, CO2, water, food, temperature, radiation, fatigue and crew health. These are linked: dust on the solar panels means less power, less power means a weaker oxygen generator and CO2 scrubber, and a lunar night makes that worse.

## Missions
| Mission | Days | What it teaches |
|---|---|---|
| First Week (training) | 7 | The basics, with an in-game advisor |
| Survive the Night | 20 | Planning ahead for the roughly two-week lunar night |
| Solar Storm | 14 | Radiation shielding and sheltering |
| August 1972 (historic) | 10 | A real solar particle event, based on NCRP Report 98 as cited by NASA |
| 30-Day Mission | 30 | Everything together, plus equipment failure and supply drops |

## How to play
1. Pick a mission.
2. Read today's alerts.
3. Set your orders: crew hours (maintenance, greenhouse, shielding, cleaning, repair), shelter on or off, greenhouse lighting, and power priority.
4. Press **End day** and read the "what you did, what happened" panel.
5. Use **Skip ahead** to repeat your orders for up to 7 days; it stops when something new happens.

Every control has a "?" button explaining what it does, why it matters and what it costs.

## Run it locally
Open `closedloop.html` (or `index.html`, an identical copy) in any browser. No install, no network needed.

To rebuild after editing the source files: `python3 build.py`
To run the balance test: `node simulate.js`

## Project files
| File | Purpose |
|---|---|
| `closedloop.html` / `index.html` | The finished single-file game |
| `src_v2.html` | Dashboard source (HTML, CSS, UI code) |
| `scene.js` | Canvas renderer for the live outpost view |
| `config.js` | Tuning numbers, scenarios and the sources list |
| `engine.js` | Simulation engine (numbers only) |
| `simulate.js` | Balance test with 8 simulated player strategies |
| `build.py` | Combines the source files into the single-file game |

## NASA data and references
Every number in `config.js` is tagged as SOURCED, DERIVED, SCALED or ASSUMPTION. The full list is shown inside the game under **Data sources**.

Main sources:
- Ewert and Stromgren, *Life Support Baseline Values and Assumptions*, ICES-2019-126 (NASA NTRS 20190027563): oxygen, CO2, water and food per crew member.
- ISS water recovery, ICES-2022-098 (NASA NTRS 20220006163): water recycler efficiency range.
- Advanced Oxygen Generation Assembly, Takada et al., ICES-2023-311 (NASA NTRS 20230008013): oxygen generator capacity.
- Four-bed CO2 scrubber, ICES-2023-119 (NASA NTRS 20230009273): scrubber capacity range.
- NASA Science, Astronomy Picture of the Day, 26 Sep 2020: the 29.5-day lunar cycle.
- NCRP Report 98, quoted in NASA's Apollo Lunar Surface Journal (Radiation page): the August 1972 solar particle event dose.
- Chang'e-4 Lunar Lander Neutron and Dosimetry instrument, Zhang et al. 2020 (a Chinese mission, not NASA): surface radiation of about 1.37 mSv/day.

Other storm sizes in the game are gameplay-scaled fractions of the August 1972 benchmark and are labelled that way in the game. A few values (solar array size, dust effect, system power use, base power, water use) are assumptions and are marked as such.

## AI usage
This project was built by a student team, utilizing AI tooling for implementation support across the simulation engine, dashboard, and technical documentation review. All design decisions, problem framing, and engineering directions originated with the team, and every sourced value was cross-checked against original NASA reports.

## Team
CLosed LOOp: Jiya Tandel
