# Lab Layout of the Day

The day's Labyrinth (all four tiers) as a web page, without Waypoint or LocalExile. A port of LocalExile's
Labyrinth generator (`LabyrinthLayout.cs`, `LabyrinthDay.cs`) and of Waypoint's lab map (`LabyrinthDay.cs`,
`LabLayoutWindow.xaml.cs`).

## Files

| File | What it is |
| --- | --- |
| `labyrinth.js` | The generator: TinyMt, the day's seed (UTC days since 1970), sections, rooms, links, secrets, area pick |
| `lab-view.js` | The map's logic: room numbers, shortest way, door sides, room features, Izaro's fights |
| `template.html` | The page (SVG map, day and tier controls, notes) |
| `build.mjs` | Builds `index.html`: the page with the day layouts inlined |
| `gen.mjs` | Writes one `out/yyyy-mm-dd.jsonl` per day in the Gateway's `labyrinth` format |
| `check.mjs`, `test-view.mjs` | Tests against Waypoint's 2026-11-07 Eternal sample (`expected-2026-11-07-t4.jsonl`) |

## Build

Put the exported tables (poe-dat-viewer's JSON export) in `tables/`: `labyrinths.json`, `labyrinthsection.json`,
`labyrinthsectionlayout.json`, `labyrinthsecrets.json`, and for room names `labyrinthareas.json` and
`worldareas.json`. Then, with Node 22:

```
node check.mjs && node test-view.mjs     # both must pass
node build.mjs 2026-10-09 396            # first day, number of days → index.html
```

`index.html` is a static page: host it anywhere, with the `ui/` folder (its textures) and `og.jpg` beside it. Rebuild it before the last day runs out.
Keep `tables/` private: only the generated layouts go into the page.

Icons: [game-icons.net](https://game-icons.net) by Lorc and Delapouite, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): crowned skull, minotaur, circular sawblade, mine wagon, lever, fire shrine, skeleton key, locked chest, locked door, gem pendant, doorway, dungeon gate. Keep this credit when you host the page.

## Link previews (Discord, Slack, X)

Build with the page's public address so shared links show a card with the map image:

```
SITE_URL=https://your-site.example/ node build.mjs
```

This writes Open Graph and Twitter tags: title, a description with that day's Eternal Labyrinth (shortest way,
Darkshrines), the gold embed colour (`theme-color`), `og:url` and `og:image` (`og.jpg`, 1200×630). Link crawlers do not
run scripts, so the description is fixed when you build: rebuild daily (a cron job; it takes under a second) to keep it
current. Discord caches a link's preview for a while after it is first posted. `og.py` re-renders `og.jpg` from the
page (Python Playwright and Pillow).




UI: `ui/` holds pieces cut from the project's own verdigris UI sheet (title bar, titled panels, gold-cornered panel,
dialog, teal/gold/bronze/green plates, tabs, field, progress bar, alert bars and icons, dividers, and a patina tile from
a panel's interior), with the black background made transparent and converted to WebP.

## Exit sides

`tables/labexits.json` gives each Labyrinth area's exits as degrees on the in-game minimap (counter-clockwise from the
right). It comes from the room graph files (`Metadata/Terrain/Labyrinth/Areas/**/Graphs/*.dgr`, read raw with
`exits/lab-exits.mjs`): each "entranceN" node is the exit to the room's N-th link. The graph's top is the minimap's
bottom (checked in game). The four `*_Labyrinth_DG_straight` areas pick one of three graphs per run, so they have none.
Keep it with the other tables: private, game-derived.
