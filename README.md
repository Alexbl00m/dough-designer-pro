# Baker's Calculator

A baker's-percentage calculator for pizza and bread that models fermentation
rather than just dividing numbers. Pick a style, set your kitchen's conditions,
and get ingredient weights, a water temperature, and a schedule with real clock
times on it.

## What it does

- **24 styles** across pizza, bread, enriched doughs and preferments, each
  carrying its own hydration, salt, timing, process and default batch size.
- **A fermentation clock that runs both ways.** Fix the time and the leavening
  follows; fix the leavening and the time follows. Same equation, so the two
  sliders can never contradict each other.
- **One currency for both leavens.** Sourdough and commercial yeast ride the
  same curve, so switching between them does not change the schedule under you.
- **Cold retards done properly.** Fridge hours convert to room-equivalent hours,
  including the time the dough is still warm on its way down.
- **Preferments.** Poolish, biga and levain are built as their own sections and
  subtracted from the final dough, so hydration and dough weight still land where
  you asked.
- **DDT water temperature**, with the arithmetic shown and an ice split when the
  target is below tap temperature.
- **A schedule with clock times** — levain build, autolyse, folds, fridge,
  shaping, preheat and bake, laid out from the moment you say you'll start.
- **Swedish and English**, light and dark, and a print stylesheet that produces a
  clean bake sheet.
- **Share by link.** Every recipe is fully described by its URL. There is no
  backend and no account.
- **An MCP server** exposing the same engine to AI assistants.

## The model

Everything is one equation and its inverse:

```
bulk hours = k(T) · log₂(S* / leaven%)
leaven%    = S* / 2^(hours / k(T))
```

`k(T)` is the population doubling time and `S*` the dose at which a dough is
already fermented. Because the two directions are the same equation rearranged,
the time slider and the dose slider can never disagree — which is the whole
point of them.

The important consequence is that **fermentation time is logarithmic in the
dose, not inversely proportional to it**. Fifty times the starter buys about
3.7× the speed, not fifty times. Every doubling of the leavening saves exactly
`k(T)` hours, whatever the dose already was. That follows from the yeast growing
during the ferment: the starting population only buys a fixed number of
doublings.

Both leavening types share one currency — ripe levain as a share of the flour it
joins — so switching from starter to commercial yeast does not silently change
the schedule.

Everything else (salt, sugar, hydration, fat, cold retards, preferment
discounts, yeast-form conversion) is a correction on top, each clamped so
extreme input can bend the answer but never break it.

### Where the numbers come from

Constants live in `src/core/constants.ts` and `src/data/fermentationTable.ts`
with the reasoning attached. The important ones are measured, not chosen:

| Constant | Value | Calibrated against |
| --- | --- | --- |
| `FERMENTATION_CURVE` | 8 anchors | A table of bulk and proof times across 8 temperatures × 8 starter doses. Fitting the law above to all 64 points recovers a near-constant `S*` (max residual 4.5%). |
| `FULL_FERMENT_PCT` | 97.7 | Recovered from that same fit rather than assumed. |
| `Q10_STARTER` | 3.8 | Russell Peace Baker's starter peak windows — 10–14 h at 18 °C, 6–8 h at 22 °C, 3–5 h at 26 °C. |
| `FRESH_YEAST_TO_STARTER` | 30 | Straight-dough practice across the range. The least certain constant, and the first place to look if yeast timings feel off. |

The temperature curve is deliberately **not** a single Q10: the measurements put
it near 5 between 10 and 13 °C, around 3 at room temperature, and flattening to
1.3 approaching the yeast optimum near 29 °C. Yeast has an optimum, and no
single exponent describes both a cold retard and a proofing box.

A per-style `fermentFactor` scales the whole clock. The curve fixes the *shape*
of fermentation but not its absolute level, which depends on how far a baker
pushes bulk — Full Proof Baking's 6 h bulk at 20% levain runs about 1.5× the
table's, because they stop at 50–60% rise. Each factor is solved so the engine
reproduces its published recipe.

`src/core/__tests__/growth.test.ts` validates the model against all 64 source
points, and `references.test.ts` pins the recipes, so a retuned constant that
drifts away from what happens on a bench fails the suite.

### Two levain conventions

Recipes usually quote inoculation as **ripe levain as a share of the flour it is
added to** ("20% levain"). The engine works internally in **starter flour as a
share of total flour**, because that is what makes the percentages add up. Both
are reported; the UI leads with the first, since that is the one you can compare
against any other recipe.

## Layout

```
src/
  core/           the engine — no React, no per-style branches
    constants.ts    every modelling constant, with its reasoning
    fermentation.ts Q10, cold retards, yeast and levain dosing, DDT
    schedule.ts     process spec → wall-clock timeline
    calculations.ts puts it together
  data/styles.ts  every style, as data
  i18n/           sv + en dictionaries and a framework-free translator
  lib/            formatting, URL state, bake log, text export
  lib/mcp/        the four MCP tools
  components/     UI
```

Adding a style means adding data to `src/data/styles.ts` and its copy to the two
dictionaries. It never means touching the engine — a test enforces that every key
a style can emit exists in both languages.

## Develop

```sh
npm install
npm run dev        # http://localhost:8080
npm test           # engine, schedule and i18n coverage
npm run typecheck
npm run build
```

## MCP server

Four tools over the same engine:

| Tool | Purpose |
| --- | --- |
| `list_styles` | Browse styles with their defaults |
| `get_style` | One style's full definition |
| `calculate_recipe` | Weights, percentages, water temperature, schedule |
| `explain_recipe` | The reasoning behind every number, in prose |

Only `style_id` is required — everything else falls back to the style's own
defaults. All four accept `language: "en" | "sv"`.
