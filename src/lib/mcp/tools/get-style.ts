import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStyleById } from "../../../data/styles";
import { createTranslator } from "../../../i18n/translate";
import { languageSchema } from "../shared";

export default defineTool({
  name: "get_style",
  title: "Get dough style details",
  description:
    "Get the full definition of one style: default hydration, salt, sugar and fat, its preferment spec, the reference yeast dose and levain inoculation with the time and temperature they were measured at, the flour blend, the process (folds, shaping, bake) and the style's default batch size.",
  inputSchema: {
    style_id: z.string().min(1).describe("Style id, e.g. 'neapolitan' (see list_styles)."),
    language: languageSchema,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ style_id, language }) => {
    const style = getStyleById(style_id);
    if (!style) throw new ToolError(`Unknown style id: ${style_id}. Use list_styles to see valid ids.`);
    const t = createTranslator(language ?? "en");

    const payload = {
      ...style,
      region: t(style.regionKey),
      description: t(`style.${style.id}.desc`),
      characteristics: Array.from({ length: style.characteristicCount }, (_, i) =>
        t(`style.${style.id}.char.${i}`),
      ),
      flourBlend: style.flourBlend?.map((f) => ({ ...f, name: t(f.key) })),
      liquids: style.liquids?.map((l) => ({ ...l, name: t(l.key) })),
      extras: style.extras?.map((e) => ({ ...e, name: t(e.key) })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: { style: payload },
    };
  },
});
