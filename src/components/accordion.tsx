"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

// Questions whose answers slide open one at a time
export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {items.map((item, index) => {
        const expanded = open === index;
        const panelId = `${id}-${index}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : index)}
                className="group flex w-full items-center justify-between gap-4 py-5 text-left font-medium"
              >
                {item.q}
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full transition duration-300 ${expanded ? "rotate-45 bg-accent-fill text-accent-foreground" : "bg-surface-2 text-muted group-hover:bg-surface-3 group-hover:text-foreground"}`}
                >
                  <Plus className="size-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              inert={!expanded}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-5 text-pretty text-muted">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
