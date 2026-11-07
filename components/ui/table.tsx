import type { ComponentProps } from "react";

import { cn } from "./cn";

/**
 * Data table. Wrap it in a <Card> (it has no border of its own) so it scrolls
 * horizontally inside the card on small screens.
 *
 *   <Card><Table><thead><tr><Th>..</Th></tr></thead><tbody><tr><Td>..</Td></tr></tbody></Table></Card>
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    // relative: keeps absolutely positioned children (e.g. sr-only labels) inside the scroll box
    <div className="relative overflow-x-auto">
      <table className={cn("min-w-full text-sm", className)} {...props} />
    </div>
  );
}

type Align = { align?: "left" | "center" | "right" };

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

export function Th({ align = "left", className, ...props }: ComponentProps<"th"> & Align) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500",
        ALIGN[align],
        className
      )}
      {...props}
    />
  );
}

export function Td({ align = "left", className, ...props }: ComponentProps<"td"> & Align) {
  return <td className={cn("border-b border-slate-100 px-4 py-3 text-slate-700", ALIGN[align], className)} {...props} />;
}

/** Table row with hover highlight. */
export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-slate-50/70", className)} {...props} />;
}
