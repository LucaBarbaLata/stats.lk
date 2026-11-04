import type { ReactNode } from "react";

// Re-mounts on every navigation, so each page fades in
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
