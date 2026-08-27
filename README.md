# Baker's Calculator

A baker's-percentage calculator for pizza and bread that models fermentation
rather than just dividing numbers. Pick a style, set your kitchen's conditions,
and get ingredient weights, a water temperature, and a schedule with real clock
times on it.

## What it does

- **24 styles** across pizza, bread, enriched doughs and preferments, each
  carrying its own hydration, salt, timing, process and default batch size.
- **Q10 fermentation model.** The yeast dose or levain inoculation is scaled to
  the time and temperature you actually have, not to the one the recipe assumed.
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

Two ideas carry the engine:

1. Fermentation *rate* follows a Q10 law — every 10 °C multiplies it by a
   constant.
2. Total gas produced is rate × time, so to keep a dough ready at a different
   time or temperature you scale the dose by the inverse of the change.

Everything else — salt, sugar, hydration, fat, cold retards, preferment
discounts, yeast-form conversion — is a correction on top of those two, and each
one is clamped so extreme input can bend the answer but never break it.

Constants live in `src/core/constants.ts` with the reasoning attached. Two of
them are calibrated against published figures rather than picked:

| Constant | Value | Calibrated against |
| --- | --- | --- |
| `Q10` (dough) | 2.0 | Full Proof Baking's bulk times at a fixed 20% levain — 7 h at 21.1 °C, 6 h at 23.3 °C, 4.5–5 h at 26.7 °C. Reproduced to within 0.2%. |
| `Q10_STARTER` | 3.8 | Russell Peace Baker's starter peak windows — 10–14 h at 18 °C, 6–8 h at 22 °C, 3–5 h at 26 °C. |

A starter and a dough deliberately do **not** share a coefficient: a starter has
to eat through a fixed amount of fresh flour before it peaks, so temperature
compresses its lag phase and growth rate together.

`src/core/__tests__/references.test.ts` pins the model to those sources, so a
retuned constant that drifts away from what happens on a bench fails the suite.

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
