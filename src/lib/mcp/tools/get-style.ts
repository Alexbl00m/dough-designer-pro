import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStyleById } from "../../../data/styles";

export default defineTool({
  name: "get_style",
  title: "Get dough style details",
  description:
    "Get the full definition of one style: default hydration, salt, sugar, oil, preferment, fermentation ratios, flour blend and characteristics.",
  inputSchema: {
    style_id: z.string().min(1).describe("Style id, e.g. 'neapolitan' (see list_styles)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ style_id }) => {
    const style = getStyleById(style_id);
    if (!style) throw new ToolError(`Unknown style id: ${style_id}. Use list_styles to see valid ids.`);
    return {
      content: [{ type: "text", text: JSON.stringify(style, null, 2) }],
      structuredContent: { style },
    };
  },
});