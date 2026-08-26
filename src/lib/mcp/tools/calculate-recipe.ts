import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStyleById } from "../../../data/styles";
import { calculateRecipe } from "../../../core/calculations";

export default defineTool({
  name: "calculate_recipe",
  title: "Calculate dough recipe",
  description:
    "Calculate a full dough recipe for a style: ingredient weights in grams, baker's percentages, water temperature, bulk and proof times, timeline and notes.",
  inputSchema: {
    style_id: z.string().min(1).describe("Style id, e.g. 'neapolitan' (see list_styles)."),
    ball_weight: z.number().describe("Weight per dough ball/loaf in grams, e.g. 265."),
    ball_count: z.number().int().describe("Number of dough balls/loaves, e.g. 8."),
    total_time: z.number().describe("Total fermentation time in hours, e.g. 24."),
    room_temp: z.number().describe("Room temperature in °C, e.g. 23."),
    cold_hours: z.number().optional().describe("Hours of cold fermentation at 4°C. Default 0."),
    leaven_type: z
      .enum(["commercial", "sourdough", "hybrid"])
      .optional()
      .describe("Leavening type. Default 'commercial'."),
    yeast_form: z
      .enum(["fresh", "active_dry", "instant"])
      .optional()
      .describe("Yeast form. Default 'instant'."),
    mixing: z
      .enum(["hand", "spiral", "planetary", "dlx"])
      .optional()
      .describe("Mixing method. Default 'hand'."),
    desired_dough_temp: z.number().optional().describe("Desired dough temperature in °C. Default 24."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const style = getStyleById(input.style_id);
    if (!style) throw new ToolError(`Unknown style id: ${input.style_id}. Use list_styles to see valid ids.`);

    const results = calculateRecipe({
      style,
      ballWeight: input.ball_weight,
      ballCount: input.ball_count,
      totalTime: input.total_time,
      roomTemp: input.room_temp,
      coldTemp: 4,
      coldHours: input.cold_hours ?? 0,
      leavenType: input.leaven_type ?? "commercial",
      yeastForm: input.yeast_form ?? "instant",
      mixing: input.mixing ?? "hand",
      desiredDoughTemp: input.desired_dough_temp ?? 24,
    });

    const payload = { style: { id: style.id, name: style.name }, ...results };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});