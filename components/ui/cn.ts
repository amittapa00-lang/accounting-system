import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom `brand` colour scale (app/globals.css),
// so `bg-slate-900` + `bg-brand-600` resolves to the last one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["brand-50", "brand-100", "brand-200", "brand-500", "brand-600", "brand-700", "brand-800"],
    },
  },
});

/**
 * Joins class names, skipping falsy values, and resolves Tailwind conflicts so a
 * later class wins: cn("px-4 py-3", dense && "px-2") -> "py-3 px-2".
 */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}
