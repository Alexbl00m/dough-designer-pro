import { defineMcp } from "@lovable.dev/mcp-js";
import listStylesTool from "./tools/list-styles";
import getStyleTool from "./tools/get-style";
import calculateRecipeTool from "./tools/calculate-recipe";
import explainRecipeTool from "./tools/explain-recipe";

export default defineMcp({
  name: "bakers-calculator",
  title: "Baker's Calculator",
  version: "1.0.0",
  instructions:
    "Tools for the Baker's Calculator, a dough engine covering pizza, bread, enriched doughs and preferments. " +
    "Use `list_styles` to browse the styles, `get_style` for one style's full definition, `calculate_recipe` to compute ingredient weights in grams and baker's percentages (split into preferment, levain and final-dough sections) plus water temperature, fermentation times and a wall-clock schedule, and `explain_recipe` when the user wants the reasoning rather than the numbers. " +
    "Every parameter on the recipe tools is optional except `style_id` — omitted values fall back to the style's own defaults, so start there and only override what the user actually specified. " +
    "All tools accept `language: 'en' | 'sv'` for the human-readable text.",
  tools: [listStylesTool, getStyleTool, calculateRecipeTool, explainRecipeTool],
});