"use client";

import React from "react";
import { Header } from "@/components/layout/header";
import { ThreePanelLayout } from "@/components/layout/three-panel-layout";
import { OntologyLayerPanel } from "@/components/ontology-layers/ontology-layer-panel";
import { OntologyCanvas } from "@/components/graph-canvas/ontology-canvas";
import { PropertyEditorPanel } from "@/components/property-editor/property-editor-panel";
import { ImportDialog } from "@/components/proposal-system/import-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores";

export default function HomePage() {
  const { showImportDialog, setShowImportDialog } = useUIStore();

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <ThreePanelLayout
          leftPanel={<OntologyLayerPanel />}
          centerPanel={<OntologyCanvas />}
          rightPanel={<PropertyEditorPanel />}
        />
        <ImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
        />
      </div>
    </TooltipProvider>
  );
}
