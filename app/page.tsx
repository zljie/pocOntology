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
import { OsiImportDialog } from "@/components/osi-import/osi-import-dialog";
import { StartupImportDialog } from "@/components/osi-import/startup-import-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOntologyStore, useUIStore } from "@/stores";
import { ConsultingRightPanel } from "@/components/consulting/consulting-right-panel";
import { ConsultingLeftPanel } from "@/components/consulting/consulting-left-panel";

export default function HomePage() {
  const { showImportDialog, setShowImportDialog, workMode, openRightPanel, setShowStartupImportDialog } = useUIStore();
  const { objectTypes, linkTypes } = useOntologyStore();

  React.useEffect(() => {
    if (workMode === "CONSULTING") {
      openRightPanel();
    }
  }, [workMode, openRightPanel]);

  React.useEffect(() => {
    if (objectTypes.length === 0 && linkTypes.length === 0) {
      setShowStartupImportDialog(true);
    }
  }, [objectTypes.length, linkTypes.length, setShowStartupImportDialog]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <ThreePanelLayout
          leftPanel={workMode === "CONSULTING" ? <ConsultingLeftPanel /> : <OntologyLayerPanel />}
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
        <OsiImportDialog />
        <StartupImportDialog />
      </div>
    </TooltipProvider>
  );
}
