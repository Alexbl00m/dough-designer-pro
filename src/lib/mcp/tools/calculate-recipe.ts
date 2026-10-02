import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { recipeInputSchema, resolveRecipe, toReadable } from "../shared";

export default defineTool({
  name: "calculate_recipe",
  title: "Calculate dough recipe",
  description:
    "Calculate a full dough recipe: ingredient weights in grams and baker's percentages, split into preferment, levain and final-dough sections; water temperature from the DDT rule; bulk and proof times; a wall-clock schedule from autolyse to bake; and any warnings. Every parameter falls back to the style's own default, so `style_id` alone returns a complete, sensible recipe.",
  inputSchema: recipeInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const resolved = resolveRecipe(input);
    if ("error" in resolved) throw new ToolError(resolved.error);

    const payload = toReadable(resolved);
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
