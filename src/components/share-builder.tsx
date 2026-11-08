"use client";

import Form from "next/form";
import { useEffect, useRef, type ReactNode } from "react";

// The custom card's form (a GET to /share). Any change updates the preview
// right away; the title waits until typing stops. The submit button inside
// covers browsers without JavaScript.
export function ShareBuilderForm({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const element = form.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (event: Event) => {
      const typing = event.target instanceof HTMLInputElement && event.target.type === "text";
      clearTimeout(timer);
      timer = setTimeout(() => element.requestSubmit(), typing ? 700 : 0);
    };
    // Select reports its choice with an input event on its hidden input
    element.addEventListener("input", update);
    element.addEventListener("change", update);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("input", update);
      element.removeEventListener("change", update);
    };
  }, []);

  return (
    <Form ref={form} action="/share" scroll={false} replace className="space-y-6">
      {children}
    </Form>
  );
}
