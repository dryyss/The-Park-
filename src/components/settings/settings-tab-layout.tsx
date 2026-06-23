"use client";

import { useState, type ReactNode } from "react";

export interface SettingsTab {
  key: string;
  label: string;
  jp: string;
  iconBg: string;
  iconColor: string;
}

export function SettingsTabLayout({
  tabs,
  defaultTab,
  children,
}: {
  tabs: SettingsTab[];
  defaultTab: string;
  children: (activeTab: string) => ReactNode;
}) {
  const [active, setActive] = useState(defaultTab);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[220px_1fr] lg:gap-7">
      <nav className="sticky top-[calc(3.5rem+0.5rem)] flex flex-row gap-1 overflow-x-auto scroll-touch lg:top-[90px] lg:flex-col lg:overflow-visible">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={[
                "flex shrink-0 items-center gap-2.5 rounded-[11px] px-3.5 py-3 text-left transition",
                isActive ? "bg-charbon-700" : "hover:bg-charbon-800",
              ].join(" ")}
            >
              <span
                className="font-jp flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[13px] font-black"
                style={{ background: tab.iconBg, color: tab.iconColor }}
              >
                {tab.jp}
              </span>
              <span className={`text-[13px] font-extrabold ${isActive ? "text-blanc-casse" : "text-texte-muet"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="min-w-0 animate-fade-up">{children(active)}</div>
    </div>
  );
}
