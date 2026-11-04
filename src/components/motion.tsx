"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// An element counts as seen once it's well inside the screen, not when its
// first pixel peeks in at the bottom edge.
const SEEN = { rootMargin: "0px 0px -15% 0px" };

// Counts from 0 up to `value` once it scrolls into view. Renders 0 on the
// server so the first paint and hydration match.
export function CountUp({ value, duration = 1400, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const run = () => {
      const start = performance.now() + (reducedMotion() ? 0 : delay);
      const length = reducedMotion() ? 0 : duration;
      const tick = (now: number) => {
        const t = length ? Math.min(1, Math.max(0, (now - start) / length)) : 1;
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          run();
        }
      },
      { ...SEEN, threshold: 1 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("en-US")}
    </span>
  );
}

// Marks its children as in view (data-inview) the first time they scroll
// into sight, so CSS animations inside can wait until then.
export function InView({
  children,
  className = "",
  threshold = 0.35,
  style,
}: {
  children: ReactNode;
  className?: string;
  // Share of the element that must be visible; keep it low for tall content
  threshold?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { ...SEEN, threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} data-inview={inView} className={`group/view ${className}`} style={style}>
      {children}
    </div>
  );
}

// Rises into place once scrolled into view
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <InView
      threshold={0.15}
      className={`animate-rise [animation-play-state:paused] data-[inview=true]:[animation-play-state:running] ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </InView>
  );
}
