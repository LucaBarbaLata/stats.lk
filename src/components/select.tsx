"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = { value: string; label: string; hint?: string };

// A dropdown in the app's own style for forms; the choice goes in a hidden
// input called `name`. Arrows, Home, End, Enter and Escape work as in a
// native select, and typing a letter jumps to the next option starting with
// it. `searchable` adds a filter box, for long lists like time zones.
export function Select({
  name,
  options,
  defaultValue,
  searchable,
  id,
  labelledBy,
}: {
  name: string;
  options: SelectOption[];
  defaultValue: string;
  searchable?: boolean;
  id?: string;
  // id of the visible label
  labelledBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  // Let the surrounding form know the value changed (SettingsForm enables Save)
  const reported = useRef(value);
  useEffect(() => {
    if (reported.current === value) return;
    reported.current = value;
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    if (searchable) search.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, searchable]);

  // Keep the highlighted option in view while moving with the keyboard
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (option: SelectOption) => {
    setValue(option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = shown.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive((index) =>
        event.key === "ArrowDown" ? Math.min(last, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : last,
      );
    } else if (event.key === "Enter" || (event.key === " " && !searchable)) {
      event.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (!searchable && event.key.length === 1) {
      const letter = event.key.toLowerCase();
      const order = [...shown.slice(active + 1), ...shown.slice(0, active + 1)];
      const match = order.find((option) => option.label.toLowerCase().startsWith(letter));
      if (match) setActive(shown.indexOf(match));
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy && id ? `${labelledBy} ${id}` : undefined}
        aria-activedescendant={open && !searchable ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 text-left ring-1 ring-transparent transition ring-inset hover:bg-surface-3 focus-visible:ring-accent/60 focus-visible:outline-none aria-expanded:ring-accent/60"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 z-40 mt-2 min-w-56 origin-top animate-menu overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-2xl shadow-black/50">
          {searchable && (
            <div className="border-b border-border/70 p-2">
              <label className="flex items-center gap-2 rounded-xl bg-surface-3 px-3">
                <Search className="size-4 shrink-0 text-subtle" />
                <span className="sr-only">Search</span>
                <input
                  ref={search}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
                  placeholder="Search"
                  autoComplete="off"
                  className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
                />
              </label>
            </div>
          )}
          <ul ref={list} id={listId} role="listbox" aria-labelledby={labelledBy} className="max-h-72 overflow-y-auto p-1.5">
            {shown.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${index === active ? "bg-surface-3 text-foreground" : "text-muted"}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate ${isSelected ? "font-medium text-foreground" : ""}`}>{option.label}</span>
                    {option.hint && <span className="block truncate text-xs text-subtle">{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="size-4 shrink-0 text-accent" />}
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-2 text-sm text-subtle">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
