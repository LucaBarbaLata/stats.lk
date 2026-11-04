import { Suspense, type ReactNode } from "react";
import { SettingsNav, SettingsNavFallback } from "@/components/settings-nav";

// Menu on the left (a row of tabs on phones); each page brings its own
// title, see SettingsHeader
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
      <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] lg:px-3">Settings</h1>
        <Suspense fallback={<SettingsNavFallback />}>
          <SettingsNav />
        </Suspense>
      </div>
      <div className="max-w-3xl space-y-6">{children}</div>
    </div>
  );
}
