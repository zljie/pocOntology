"use client";

import React from "react";
import { Header } from "@/components/layout/header";
import { ThreePanelLayout } from "@/components/layout/three-panel-layout";
import { OntologyLayerPanel } from "@/components/ontology-layers/ontology-layer-panel";
import { OntologyCanvas } from "@/components/graph-canvas/ontology-canvas";
import { PropertyEditorPanel } from "@/components/property-editor/property-editor-panel";
import { KineticEditorPanel } from "@/components/property-editor/kinetic-editor-panel";
import { DynamicEditorPanel } from "@/components/property-editor/dynamic-editor-panel";
import { RightSemanticQueryPanel } from "@/components/semantic-query/right-semantic-query-panel";
import { ProjectOnboardingRightPanel } from "@/components/project-onboarding/project-onboarding-right-panel";
import { ImportDialog } from "@/components/proposal-system/import-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores";
import { BusinessDomainPlannerPanel } from "@/components/consulting/business-domain-planner-panel";
import { ConsultingRightPanel } from "@/components/consulting/consulting-right-panel";

export default function HomePage() {
  const { showImportDialog, setShowImportDialog, workMode, openRightPanel } = useUIStore();

  React.useEffect(() => {
    if (workMode === "CONSULTING") {
      openRightPanel();
    }
  }, [workMode, openRightPanel]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <ThreePanelLayout
          leftPanel={workMode === "CONSULTING" ? <BusinessDomainPlannerPanel /> : <OntologyLayerPanel />}
          centerPanel={<OntologyCanvas />}
          showBottomPreview={workMode !== "CONSULTING"}
          rightPanel={workMode === "CONSULTING" ? <ConsultingRightPanel /> : (
            <>
              <ProjectOnboardingRightPanel />
              <PropertyEditorPanel />
              <KineticEditorPanel />
              <DynamicEditorPanel />
              <RightSemanticQueryPanel />
            </>
          )}
        />
        <ImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
        />
      </div>
    </TooltipProvider>
  );
}
