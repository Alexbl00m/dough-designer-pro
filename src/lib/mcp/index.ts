import { defineMcp } from "@lovable.dev/mcp-js";
import listStylesTool from "./tools/list-styles";
import getStyleTool from "./tools/get-style";
import calculateRecipeTool from "./tools/calculate-recipe";
import explainRecipeTool from "./tools/explain-recipe";

export default defineMcp({
  name: "dough-designer-pro",
  title: "dough-designer-pro",
  version: "0.1.0",
  instructions:
    "Tools for the Baker's Calculator. Use `list_styles` to browse bread and pizza styles, `get_style` for a style's default parameters, `calculate_recipe` to compute ingredient weights, water temperature, fermentation times and a baking timeline, and `explain_recipe` for a plain-language walkthrough of the same recipe including the reasoning behind each correction.",
  tools: [listStylesTool, getStyleTool, calculateRecipeTool, explainRecipeTool],
});