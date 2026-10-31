"use client";

import { useState, type ReactNode } from "react";

type CampaignTabsProps = {
  overview: ReactNode;
  proofs: ReactNode;
  updates: ReactNode;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "proofs", label: "Verification proofs" },
  { id: "updates", label: "Updates & milestones" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function CampaignTabs({
  overview,
  proofs,
  updates,
}: CampaignTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const panel: Record<TabId, ReactNode> = { overview, proofs, updates };

  return (
    <section className="min-w-0">
      <div
        aria-label="Campaign information"
        className="flex overflow-x-auto border-b border-slate-200"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-controls={`campaign-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-emerald-700 text-emerald-900"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
            id={`campaign-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          aria-labelledby={`campaign-tab-${tab.id}`}
          className={activeTab === tab.id ? "pt-5" : "hidden"}
          id={`campaign-panel-${tab.id}`}
          key={tab.id}
          role="tabpanel"
          tabIndex={0}
        >
          {panel[tab.id]}
        </div>
      ))}
    </section>
  );
}
