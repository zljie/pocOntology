"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessDomainPlannerPanel } from "@/components/consulting/business-domain-planner-panel";
import { CasePlaybookPanel } from "@/components/consulting/case-playbook-panel";

export function ConsultingLeftPanel() {
  const [tab, setTab] = React.useState<"domain" | "cases">("domain");

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-3 border-b border-[#2d2d2d] bg-[#161614]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="bg-[#0d0d0d] border border-[#2d2d2d]">
            <TabsTrigger value="domain" className="text-xs">
              业务域
            </TabsTrigger>
            <TabsTrigger value="cases" className="text-xs">
              案例
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0">
        {tab === "domain" ? <BusinessDomainPlannerPanel /> : <CasePlaybookPanel />}
      </div>
    </div>
  );
}

