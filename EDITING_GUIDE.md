# How to edit your game (beginner guide)

You do NOT need to be a programmer for most of this. Follow the steps, change one small thing at a time, and look at the result.

## 0. One-time setup (10 minutes)
1. Install **VS Code** (free): code.visualstudio.com
2. In VS Code, open the Extensions tab (square icon on the left), search **Live Server**, install it.
3. Make a folder, for example `CLosedLOOp`, and put ALL the project files in it (from `closedloop_project.zip`).
4. **Make a backup copy of the whole folder now.** Name it `CLosedLOOp_backup`. If anything goes wrong you can copy files back.
5. In VS Code: File > Open Folder > choose `CLosedLOOp`.

## 1. Which file do I edit? (important)
| I want to change... | Edit this file |
|---|---|
| Colours, text, buttons, layout | `src_v2.html` |
| Game numbers, mission lengths, storm strength | `config.js` |
| The Moon picture | `scene.js` (advanced, see section 6) |
| Game rules | `engine.js` (do not touch without asking Claude) |

`closedloop.html` is the **finished game**. It is made automatically from the other files. **Do not edit it directly if you can avoid it**, because the next rebuild would erase your changes.

## 2. How to see your changes (the loop)
1. Edit and press **Ctrl+S** (save).
2. Rebuild the finished game (see section 7).
3. Right-click `closedloop.html` in VS Code > **Open with Live Server**. After this, every rebuild refreshes the page by itself.
4. Something looks wrong? Press **F12** in the browser, open **Console**. Red text there tells you what broke. Copy it and send it to Claude.
5. Made a mistake? **Ctrl+Z** in VS Code undoes it.

## 3. Easy change 1: colours (5 minutes, great first task)
Open `src_v2.html`. At the top (around line 9) you will see:

```
:root{
  --bg:#04060a; --panel:#0a0f18; --panel2:#101826; --line:#1f2c44;
  --text:#f4f7fc; --mute:#93a3c0; --gold:#fc3d21; ...
  --blue:#4d9bff; --nasa:#0b3d91; --sun:#ffc94d;
  --ok:#3ddc97; --warn:#ffb020; --crit:#ff5468;
}
```
Each name is a colour used everywhere. Change the code after the `#` and save.
- `--bg` = page background, `--panel` = card background.
- `--gold` = the red accent (brand text). The name is old but it works.
- `--nasa` = main button colour, `--blue` = highlights and help.
- `--ok`, `--warn`, `--crit` = green, yellow, red for meters. Keep these obvious so players understand danger.
To pick a colour code, search "colour picker" in Google and copy the `#` code.

## 4. Easy change 2: text and wording
Still in `src_v2.html`, find these lists (use **Ctrl+F** to search the name):
- `HOUR_TASKS` : the names and help text of the 5 crew jobs.
- `METER_HELP` : the explanation under each meter.
- `DESC` : the mission descriptions on the menu.
- `HINTS` : the pop-up tips (storm, dust, leak...).
- `TOUR` : the 3 welcome steps.
- `CAUSE` and `DMG_WHY` : the wording of the end screen and the damage messages.
Change the words inside the quotes `'...'` only. Do not delete the quote marks or commas. If you need an apostrophe inside, write `\'` (for example `don\'t`).
Other text: the title and menu text are around lines 138 to 220 (search `Choose a mission`).

## 5. Easy change 3: your logo or an image
1. Put the image (for example `logo.png`) in the same folder.
2. In `src_v2.html`, search for `class="brand"` and add this just above it:
   `<img src="logo.png" alt="CLosed LOOp logo" height="40">`
3. NOTE: the single-file game does not carry images inside. If you want ONE file to share, ask Claude to embed the image into the file.

## 6. Changing the numbers of the game (`config.js`)
Open `config.js`. Each line has a number and a comment. Examples:
- `crewSize: 4` : number of astronauts (do not change without asking, the visuals assume 4).
- `solarKW: 16` : how powerful the solar panels are.
- `batteryCapacityKWh: 1500` : battery size.
- Storm strength: search `dose: 250` in the scenarios part. Bigger number = more dangerous storm.
- Mission length: `length: 7` in each scenario.
Lines with **(verify)** are numbers that must be checked against real NASA sources before the demo. Do not change them yourself yet, we will fix them together.
After any change in `config.js`: rebuild (section 7), then ask Claude to run the balance test, because a small change can make a mission impossible or too easy.

## 7. Rebuilding the finished game
The finished game gets made from the pieces. Pick ONE way:
- **Easiest:** send Claude the files you changed and say "rebuild". You get the new `closedloop.html` back.
- **If Python is installed:** open the VS Code terminal (Terminal > New Terminal) and type `python3 build.py` (on Windows try `python build.py`). It prints `built closedloop.html`.

## 8. The Moon picture (`scene.js`) - advanced
It is about 550 lines of drawing code. Safe tiny changes for a beginner:
- **Crew suit colours:** search `CREW_COL` and change the four `#` codes.
- **Label text:** search `callout(g,` to find the labels such as 'SOLAR ARRAY'. Change the words inside the quotes.
For bigger visual ideas (new buildings, new animations), describe what you want to Claude in plain words, for example "add a lunar rover that drives past during the day". That is faster and safer than learning canvas drawing this week.

## 9. Designing a new dashboard layout (Figma)
1. Go to figma.com, make a free account, create a Design file.
2. Draw rectangles for each card (Alerts, Outpost view, Orders, Status, Trends) and arrange them how you like. Add colours and fonts.
3. Take a screenshot or export it as PNG and give it to Claude with notes such as "move the Orders card to the left, make meters bigger". Claude turns your design into working code.
This is the best way for a beginner to control the design without writing layout code.

## 10. Golden rules
1. Backup before you start. Change one thing, test, repeat.
2. Never delete a `{`, `}`, `(`, `)`, quote or comma by accident. If the page turns blank after an edit, undo (Ctrl+Z) and look at the F12 Console.
3. Do not edit `engine.js` or `closedloop.html` directly.
4. After each working change, tell Claude what you changed so `HANDOFF.md` stays up to date.
5. Stop experimenting 2 days before your 13 Nov deadline. From then on, only safe edits (text and colours) and testing.
