import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { recipeInputSchema, resolveRecipe } from "../shared";
import { Q10 } from "../../../core/constants";
import { formatGrams } from "../../../core/calculations";

export default defineTool({
  name: "explain_recipe",
  title: "Explain dough recipe",
  description:
    "Calculate a recipe and return a plain-language walkthrough of the reasoning behind every number: how the yeast or levain dose was scaled for time and temperature (Q10), what each correction did, how cold hours convert to room-equivalent time, why the water is at that temperature, how a preferment is subtracted from the final dough, and how bulk and proof were split.",
  inputSchema: recipeInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const resolved = resolveRecipe(input);
    if ("error" in resolved) throw new ToolError(resolved.error);

    const { style, results: r, t } = resolved;
    const f = r.fermentation;
    const p = r.params;
    const num = (value: number, decimals = 2) => value.toFixed(decimals).replace(/\.?0+$/, "");

    const sections: string[] = [];

    sections.push(
      `# ${style.name} — ${r.totals.pieces} × ${formatGrams(r.totals.perPiece)} g (${formatGrams(r.totals.doughWeight)} g of dough)\n` +
        `${t(`style.${style.id}.desc`)} (${t(style.regionKey)})`,
    );

    // ── Ingredients ──
    const ingredientLines = r.sections
      .map((section) => {
        const meta = section.meta
          ? ` — ${section.meta.hours} h at ${section.meta.tempC} °C`
          : "";
        const rows = section.ingredients
          .map((i) => `  - ${t(i.key)}: ${formatGrams(i.grams)} g (${i.percentage.toFixed(2)}%)`)
          .join("\n");
        return `### ${t(section.titleKey)}${meta}\n${rows}\n  Total: ${formatGrams(section.totalGrams)} g`;
      })
      .join("\n\n");

    sections.push(
      `## Ingredients\n${ingredientLines}\n\n` +
        `Why these weights: everything is a percentage of the **total** flour (${formatGrams(r.totals.flour)} g), ` +
        `including the flour inside any preferment or starter. The flour weight itself is solved backwards from the ` +
        `dough weight you asked for — target ÷ (100% flour + ${num(p.hydration, 1)}% water + ${num(p.salt, 1)}% salt` +
        (p.sugar ? ` + ${num(p.sugar, 1)}% sugar` : "") +
        (p.oil ? ` + ${num(p.oil, 1)}% fat` : "") +
        `) — so the finished dough lands on ${formatGrams(r.totals.doughWeight)} g rather than overshooting it.`,
    );

    // ── Fermentation time ──
    const timeExplain =
      f.coldHours > 0
        ? `You asked for ${num(f.totalHours, 1)} h in total, with ${num(f.coldHours, 1)} h at ${num(f.coldTempC, 1)} °C. ` +
          `Fermentation follows a Q10 law — every 10 °C roughly multiplies the rate by ${Q10} — so fridge hours are worth far less than room hours. ` +
          `The model also credits the first 1.5 h in the fridge at the midpoint temperature, because a tub of dough takes hours to actually cool down and ferments briskly on the way. ` +
          `Net effect: this schedule behaves like a **${num(f.roomEquivHours, 1)} h** ferment at ${num(f.roomTempC, 1)} °C, and the leavening is dosed for that number, not for the ${num(f.totalHours, 1)} h on the clock.`
        : `The whole ${num(f.totalHours, 1)} h runs at ${num(f.roomTempC, 1)} °C, so clock time and effective fermentation time are the same.`;

    // ── Leavening ──
    let leavenExplain: string;
    if (f.leavenType === "sourdough") {
      leavenExplain =
        `This is a levain build at **${num(f.inoculationPct, 1)}% inoculation** — that share of the total flour arrives already fermented in the starter, ` +
        `which is ${num(f.starterPct, 1)}% ripe levain on flour at ${num(p.starterHydration, 0)}% hydration.\n\n` +
        `Why that number: the reference for this style is ${num(f.baseInoculationPct, 1)}% over ${num(f.levainRefHours, 1)} h at ${num(f.levainRefTempC, 1)} °C. ` +
        `Scaling for time (${num(f.levainRefHours, 1)} / ${num(f.roomEquivHours, 1)} h) and for temperature (Q10 = ${Q10}) gives ${num(f.inoculationPct, 1)}%. ` +
        `The starter's flour and water are then subtracted from the main flour and water, so the final hydration still lands on ${num(p.hydration, 1)}%.`;
    } else {
      const c = f.corrections;
      const lines = [
        `- **Base dose**: ${num(style.fermentation.base_yeast_fresh_pct, 3)}% fresh yeast, measured over ${num(style.fermentation.yeast_ref_hours, 1)} h at ${num(style.fermentation.yeast_ref_temp_c, 1)} °C. Every style carries its own reference conditions, so a 2 h enriched dough and a 24 h pizza dough are directly comparable.`,
        `- **Time** ×${num(c.time)}: the dose scales as reference hours ÷ ${num(f.roomEquivHours, 1)} effective hours. Half the time needs twice the yeast.`,
        `- **Temperature** ×${num(c.temperature)}: at ${num(f.roomTempC, 1)} °C the dough ferments differently than at the reference, by Q10 = ${Q10}.`,
        `- **Salt at ${num(p.salt, 1)}%** ×${num(c.salt)}: salt draws water out of yeast cells, so more salt needs more yeast.`,
        `- **Sugar at ${num(p.sugar, 1)}%** ×${num(c.sugar)}: sugar feeds yeast at low doses but stresses it osmotically above ~8%.`,
        `- **Hydration at ${num(p.hydration, 1)}%** ×${num(c.hydration)}: a wetter dough is more mobile and ferments faster, so it needs slightly less.`,
        `- **Fat at ${num(p.oil, 1)}%** ×${num(c.fat)}: fat coats the gluten and slows gas capture, so rich doughs need a nudge up.`,
        f.yeastForm !== "fresh"
          ? `- **Form conversion** ×${num(c.form)}: fresh yeast → ${t(`field.yeast.${f.yeastForm}`).toLowerCase()}, because dried yeast is far more concentrated.`
          : null,
        p.prefermentFlourPct > 0
          ? `- **Preferment discount**: ${num(p.prefermentFlourPct, 0)}% of the flour arrives already fermented and full of active yeast, so the final dough needs less.`
          : null,
        f.leavenType === "hybrid"
          ? `- **Hybrid**: the levain carries half the lift, so both doses are halved against their solo equivalents.`
          : null,
      ].filter(Boolean);

      leavenExplain =
        `Yeast: **${num(f.yeastPct, 3)}% ${t(`field.yeast.${f.yeastForm}`).toLowerCase()}** = ${formatGrams(r.totals.flour * (f.yeastPct / 100))} g.\n\n` +
        `Each correction in turn:\n${lines.join("\n")}\n\n` +
        `Every correction is clamped, so an extreme input can bend the answer but never produce a negative or absurd dose.`;
    }

    sections.push(`## Fermentation\n${timeExplain}\n\n${leavenExplain}`);

    // ── Water temperature ──
    const prefermentTerm = r.sections.find((s) => s.id === "preferment")?.meta;
    sections.push(
      `## Water temperature — ${num(r.water.tempC, 1)} °C\n` +
        `Target dough temperature is ${num(r.water.desiredDoughTempC, 1)} °C. The bakery rule multiplies that target by the number of temperature factors in the mix and subtracts everything you cannot control:\n\n` +
        `\`${r.water.factors} × ${num(r.water.desiredDoughTempC, 1)} − flour ${num(r.water.flourTempC, 1)} − room ${num(f.roomTempC, 1)} − friction ${r.water.frictionC}` +
        (prefermentTerm ? ` − preferment ${num(prefermentTerm.tempC, 1)}` : "") +
        ` = ${num(r.water.rawTempC, 1)} °C\`\n\n` +
        `Why: mixing itself heats the dough, and the more powerful the mixer the more it adds. Water is the only ingredient you can easily temper, so it absorbs the whole correction. ` +
        (prefermentTerm
          ? `Because a preferment goes into this mix, it counts as a fourth temperature factor rather than three.\n\n`
          : `A straight dough has three factors: flour, room and friction.\n\n`) +
        (r.water.clamped
          ? `Note: ${num(r.water.rawTempC, 1)} °C is outside a practical range, so the recipe uses ${num(r.water.tempC, 1)} °C and the dough will land a little off target.\n\n`
          : "") +
        (r.water.iceGrams > 0
          ? `To get there, swap ${r.water.iceGrams} g of the water for ice — melting ice absorbs 80 cal/g, so a little goes a long way.\n\n`
          : "") +
        `Hitting the dough temperature matters more than watching the clock: a dough 2 °C warmer ferments roughly 15% faster.`,
    );

    // ── Bulk and proof ──
    sections.push(
      `## Bulk and proof — ${num(f.bulkHours, 1)} h bulk, ${num(f.proofHours, 1)} h final proof\n` +
        `The ${num(f.totalHours, 1)} h are split on this style's ratio (${style.fermentation.bulk_ratio} bulk / ${style.fermentation.proof_ratio} proof, normalised to sum to 1)` +
        (f.coldHours > 0 ? `, with the retard placed in the ${f.coldPhase}` : "") +
        `.\n\nWhy: bulk fermentation builds flavour and strength while the dough is still one mass; the final proof only needs enough time for the shaped piece to relax and inflate. ` +
        (style.category === "pizza"
          ? `Pizza styles are bulk-heavy so the balls stay easy to open.`
          : `Loaf styles keep a longer final proof so the shaped piece can fully expand.`),
    );

    if (r.notes.length) {
      sections.push(
        `## Notes\n${r.notes.map((n) => `- ${t(n.code, n.values)}`).join("\n")}`,
      );
    }

    sections.push(
      `## Schedule\n${r.timeline
        .map((step) => {
          const values = step.values?.technique
            ? { ...step.values, technique: t(String(step.values.technique)) }
            : step.values;
          const clock = new Date(step.at).toISOString().slice(11, 16);
          const duration = step.durationMin > 0 ? ` (${step.durationMin} min)` : "";
          return `- ${clock} — **${t(step.key, values)}**${duration}: ${t(`${step.key}.body`, values)}`;
        })
        .join("\n")}\n\nReady at ${new Date(r.readyAt).toISOString().slice(0, 16).replace("T", " ")} UTC.`,
    );

    const explanation = sections.join("\n\n");

    return {
      content: [{ type: "text", text: explanation }],
      structuredContent: {
        style: { id: style.id, name: style.name },
        explanation,
      },
    };
  },
});
