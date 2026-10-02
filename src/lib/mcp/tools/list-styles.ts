import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { BREAD_STYLES } from "../../../data/styles";
import { createTranslator } from "../../../i18n/translate";
import { languageSchema } from "../shared";

export default defineTool({
  name: "list_styles",
  title: "List dough styles",
  description:
    "List every built-in bread and pizza style with its id, name, region, category, default hydration and salt, whether it uses a preferment or sourdough, and its default batch size and timing. Optionally filter by category.",
  inputSchema: {
    category: z
      .enum(["pizza", "bread", "enriched", "preferment"])
      .optional()
      .describe("Optional category filter."),
    language: languageSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category, language }) => {
    const t = createTranslator(language ?? "en");
    const styles = BREAD_STYLES.filter((s) => !category || s.category === category).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      region: t(s.regionKey),
      description: t(`style.${s.id}.desc`),
      hydration_pct: s.defaultParams.hydration_pct,
      salt_pct: s.defaultParams.salt_pct,
      preferment: s.preferment ? s.preferment.type : null,
      default_leaven: s.defaults.leavenType,
      default_batch: `${s.defaults.ballCount} × ${s.defaults.ballWeight} g`,
      default_fermentation_hours: s.defaults.totalTime,
      default_cold_hours: s.defaults.coldHours,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(styles, null, 2) }],
      structuredContent: { styles },
    };
  },
});
