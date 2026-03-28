import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  showMinimap: boolean;
  showGrid: boolean;
  canvasViewMode: 'EDITOR' | 'KNOWLEDGE_GRAPH';
  showProposalBanner: boolean;
  showImportDialog: boolean;
  activeTab: string;

  // UI Actions
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  toggleCanvasViewMode: () => void;
  toggleProposalBanner: () => void;
  setShowImportDialog: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  openRightPanel: () => void;
  closeRightPanel: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      leftPanelOpen: true,
      rightPanelOpen: false,
      leftPanelWidth: 340,
      rightPanelWidth: 400,
      showMinimap: true,
      showGrid: true,
      canvasViewMode: 'EDITOR',
      showProposalBanner: true,
      showImportDialog: false,
      activeTab: 'general',

      toggleLeftPanel: () =>
        set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

      toggleRightPanel: () =>
        set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

      setLeftPanelWidth: (width) =>
        set({ leftPanelWidth: Math.max(280, Math.min(500, width)) }),

      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: Math.max(320, Math.min(600, width)) }),

      toggleMinimap: () =>
        set((state) => ({ showMinimap: !state.showMinimap })),

      toggleGrid: () =>
        set((state) => ({ showGrid: !state.showGrid })),

      toggleCanvasViewMode: () =>
        set((state) => ({
          canvasViewMode: state.canvasViewMode === 'EDITOR' ? 'KNOWLEDGE_GRAPH' : 'EDITOR',
        })),

      toggleProposalBanner: () =>
        set((state) => ({ showProposalBanner: !state.showProposalBanner })),

      setShowImportDialog: (show) =>
        set({ showImportDialog: show }),

      setActiveTab: (tab) =>
        set({ activeTab: tab }),

      openRightPanel: () =>
        set({ rightPanelOpen: true }),

      closeRightPanel: () =>
        set({ rightPanelOpen: false }),
    }),
    {
      name: 'ontology-ui-storage',
      partialize: (state) => ({
        leftPanelOpen: state.leftPanelOpen,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        showMinimap: state.showMinimap,
        showGrid: state.showGrid,
        canvasViewMode: state.canvasViewMode,
      }),
    }
  )
);
