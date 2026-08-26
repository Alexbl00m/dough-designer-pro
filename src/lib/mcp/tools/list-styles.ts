import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { BREAD_STYLES } from "../../../data/styles";

export default defineTool({
  name: "list_styles",
  title: "List dough styles",
  description:
    "List all built-in bread and pizza styles with their id, name, region and category. Optionally filter by category.",
  inputSchema: {
    category: z
      .enum(["pizza", "bread", "enriched", "preferment"])
      .optional()
      .describe("Optional category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const styles = BREAD_STYLES.filter((s) => !category || s.category === category).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      region: s.region,
      description: s.description,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(styles, null, 2) }],
      structuredContent: { styles },
    };
  },
});