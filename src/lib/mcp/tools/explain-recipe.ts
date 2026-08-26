import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStyleById } from "../../../data/styles";
import { calculateRecipe } from "../../../core/calculations";

export default defineTool({
  name: "explain_recipe",
  title: "Explain dough recipe",
  description:
    "Calculate a recipe and return a human-friendly, plain-language explanation of it, including the 'why' behind every key correction: yeast scaling for time and temperature (Q10), salt/sugar/hydration corrections, cold-retard equivalence, DDT water temperature and the bulk/proof split.",
  inputSchema: {
    style_id: z.string().min(1).describe("Style id, e.g. 'neapolitan' (see list_styles)."),
    ball_weight: z.number().describe("Weight per dough ball/loaf in grams, e.g. 265."),
    ball_count: z.number().int().describe("Number of dough balls/loaves, e.g. 8."),
    total_time: z.number().describe("Total fermentation time in hours, e.g. 24."),
    room_temp: z.number().describe("Room temperature in °C, e.g. 23."),
    cold_hours: z.number().optional().describe("Hours of cold fermentation at 4°C. Default 0."),
    hydration: z.number().optional().describe("Override hydration in baker's %, e.g. 65."),
    salt: z.number().optional().describe("Override salt in baker's %, e.g. 2.5."),
    leaven_type: z.enum(["commercial", "sourdough", "hybrid"]).optional().describe("Leavening type. Default 'commercial'."),
    yeast_form: z.enum(["fresh", "active_dry", "instant"]).optional().describe("Yeast form. Default 'instant'."),
    mixing: z.enum(["hand", "spiral", "planetary", "dlx"]).optional().describe("Mixing method. Default 'hand'."),
    desired_dough_temp: z.number().optional().describe("Desired dough temperature in °C. Default 24."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const style = getStyleById(input.style_id);
    if (!style) throw new ToolError(`Unknown style id: ${input.style_id}. Use list_styles to see valid ids.`);

    const roomTemp = input.room_temp;
    const leavenType = input.leaven_type ?? "commercial";
    const yeastForm = input.yeast_form ?? "instant";
    const mixing = input.mixing ?? "hand";
    const ddt = input.desired_dough_temp ?? 24;

    const r = calculateRecipe({
      style,
      ballWeight: input.ball_weight,
      ballCount: input.ball_count,
      totalTime: input.total_time,
      roomTemp,
      coldTemp: 4,
      coldHours: input.cold_hours ?? 0,
      hydration: input.hydration,
      salt: input.salt,
      leavenType,
      yeastForm,
      mixing,
      desiredDoughTemp: ddt,
    });

    const p = r.params;
    const q10 = Math.pow(2.2, (roomTemp - 23) / 10);
    const friction = { hand: 2, spiral: 8, planetary: 6, dlx: 4 }[mixing];

    const sections: string[] = [];

    sections.push(
      `# ${style.name} — ${input.ball_count} × ${input.ball_weight} g (${p.totalDoughWeight} g dough)\n` +
        `${style.description} (${style.region}).`
    );

    sections.push(
      `## Ingredients\n` +
        r.ingredients
          .map((i) => `- ${i.name}: ${i.grams < 10 ? i.grams.toFixed(2) : Math.round(i.grams)} g (${i.percentage}% of flour)`)
          .join("\n") +
        `\n\nWhy: everything is expressed in baker's percentages against ${r.totalFlour} g of flour. ` +
        `The flour weight is derived by dividing the target dough weight by the sum of all percentages (100% flour + ${p.hydration}% water + ${p.salt}% salt` +
        (p.sugar ? ` + ${p.sugar}% sugar` : "") +
        (p.oil ? ` + ${p.oil}% fat` : "") +
        `), so the finished dough lands on the weight you asked for instead of overshooting it.`
    );

    const timeExplain =
      p.coldHours > 0
        ? `You asked for ${p.totalTime} h total with ${p.coldHours} h in the fridge. Cold fermentation at 4 °C runs at roughly 30% of room-temperature speed, so those ${p.coldHours} h count as about ${(p.coldHours * 0.3).toFixed(1)} h of activity. The dough therefore behaves like a ${p.roomEquivTime} h room-temperature ferment, and the yeast is dosed for that — not for the ${p.totalTime} h on the clock.`
        : `The whole ${p.totalTime} h runs at room temperature, so clock time and effective fermentation time are the same (${p.roomEquivTime} h).`;

    const yeastExplain =
      leavenType === "sourdough"
        ? `This is a sourdough build: ${p.inoculationPct}% inoculation (starter flour as a share of total flour). The starter's flour and water are subtracted from the main flour and water so the final hydration stays at ${p.hydration}%.`
        : leavenType === "hybrid"
        ? `Hybrid leavening: ${p.inoculationPct}% starter for flavour plus ${r.yeastPercentage}% ${yeastForm.replace("_", " ")} yeast for reliable lift. Both doses are halved versus their solo equivalents so the dough doesn't over-ferment.`
        : `Yeast: ${r.yeastPercentage}% ${yeastForm.replace("_", " ")} yeast.\n\n` +
          `Why that number — each correction in turn:\n` +
          `- Base dose: ${style.fermentation.base_yeast_fresh_pct || 0.3}% fresh yeast, the reference dose for this style over 24 h at 23 °C.\n` +
          `- Time: the dose scales as 24 / ${p.roomEquivTime} h. Less time needs proportionally more yeast; a long ferment needs very little.\n` +
          `- Temperature (Q10 = 2.2): at ${roomTemp} °C the dough ferments ${q10.toFixed(2)}× as fast as at 23 °C, so the dose is divided by ${q10.toFixed(2)}. Every 10 °C roughly doubles yeast activity.\n` +
          `- Salt at ${p.salt}%: salt draws water out of yeast cells and slows them, so above 2% the dose is nudged up (and below 2%, down).\n` +
          (p.sugar
            ? `- Sugar at ${p.sugar}%: sugar feeds the yeast at low levels but at high levels its osmotic pressure stresses them, so the dose is raised slightly.\n`
            : "") +
          `- Hydration at ${p.hydration}%: a wetter dough is more mobile and ferments faster, so wetter doughs get slightly less yeast.\n` +
          (yeastForm !== "fresh"
            ? `- Form conversion: fresh yeast → ${yeastForm.replace("_", " ")} using ${yeastForm === "instant" ? "×0.33" : "×0.40"}, because dried yeast is far more concentrated.\n`
            : "") +
          `All corrections are clamped, so extreme inputs can never produce a negative or absurd dose.`;

    sections.push(`## Fermentation\n${timeExplain}\n\n${yeastExplain}`);

    sections.push(
      `## Water temperature — ${r.waterTemp} °C\n` +
        `Desired dough temperature is ${ddt} °C. Using the standard DDT rule for a three-factor dough: water = 3 × ${ddt} − flour temp (${roomTemp} °C) − room temp (${roomTemp} °C) − friction (${friction} °C for ${mixing} mixing).\n\n` +
        `Why: mixing itself heats the dough, and the more powerful the mixer the more it adds (${mixing} ≈ ${friction} °C). Water is the only ingredient you can easily temper, so it absorbs the whole correction. Hitting the dough temperature matters more than the clock — a dough 2 °C warmer ferments roughly 15% faster.`
    );

    sections.push(
      `## Bulk and proof — ${r.bulkTime} h bulk, ${r.proofTime} h final proof\n` +
        `The ${p.totalTime} h are split using this style's ratio (${style.fermentation.bulk_ratio} bulk / ${style.fermentation.proof_ratio} proof, normalised to sum to 1). ` +
        `Why: bulk fermentation builds flavour and strength while the dough is one mass; the final proof after shaping only needs enough time to relax and inflate the shaped piece. ${style.category === "pizza" ? "Pizza styles are bulk-heavy so the balls stay easy to open." : "Loaf styles keep a longer final proof so the shaped piece can fully expand."}`
    );

    if (r.notes.length) sections.push(`## Notes\n${r.notes.map((n) => `- ${n}`).join("\n")}`);

    sections.push(`## Timeline\n${r.timeline.map((t) => `- ${t.time} — ${t.action}: ${t.description}`).join("\n")}`);

    const explanation = sections.join("\n\n");

    return {
      content: [{ type: "text", text: explanation }],
      structuredContent: { style: { id: style.id, name: style.name }, explanation, recipe: r },
    };
  },
});
