import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/*
 * tailwind-merge only knows Tailwind's own scale. Without these groups it reads
 * `text-body-sm` as a colour and `rounded-pill` as nothing it can merge, so a
 * button's size class silently removed its text colour, or the other way round.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-xl",
            "display-lg",
            "display-md",
            "display-sm",
            "lead",
            "body-lg",
            "body",
            "body-sm",
            "caption",
            "micro",
          ],
        },
      ],
      rounded: [{ rounded: ["utility", "card", "pill"] }],
      shadow: [{ shadow: ["float"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
