"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OnboardingState, OnboardingStepId } from "@/lib/types/project-onboarding";
import { buildDefaultOnboardingState } from "@/lib/types/project-onboarding";

type OnboardingStore = {
  onboardingByProject: Record<string, OnboardingState>;
  initProjectOnboarding: (dbName: string) => OnboardingState;
  hydrateProjectOnboarding: (dbName: string, state: OnboardingState) => void;
  setCurrentStep: (dbName: string, stepId: OnboardingStepId) => void;
  setStepInput: (dbName: string, stepId: OnboardingStepId, inputText: string) => void;
  setStepProposal: (dbName: string, stepId: OnboardingStepId, assistantMarkdown: string, proposalJson: unknown) => void;
  confirmStep: (dbName: string, stepId: OnboardingStepId, appliedMetaIds?: string[]) => void;
  rollbackTo: (dbName: string, stepId: OnboardingStepId) => void;
  clearProjectOnboarding: (dbName: string) => void;
};

const ORDER: OnboardingStepId[] = ["SCOPE", "OBJECTS", "SCENARIOS", "ACTIONS"];

function nextStep(stepId: OnboardingStepId): OnboardingStepId | null {
  const idx = ORDER.indexOf(stepId);
  if (idx < 0) return null;
  return ORDER[idx + 1] || null;
}

function cloneState(state: OnboardingState): OnboardingState {
  return JSON.parse(JSON.stringify(state)) as OnboardingState;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      onboardingByProject: {},

      initProjectOnboarding: (dbName) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return buildDefaultOnboardingState("");
        const existing = get().onboardingByProject[trimmed];
        if (existing) return existing;
        const state = buildDefaultOnboardingState(trimmed);
        set((prev) => ({
          onboardingByProject: {
            ...prev.onboardingByProject,
            [trimmed]: state,
          },
        }));
        return state;
      },

      hydrateProjectOnboarding: (dbName, state) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => ({
          onboardingByProject: {
            ...prev.onboardingByProject,
            [trimmed]: state,
          },
        }));
      },

      setCurrentStep: (dbName, stepId) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const existing = prev.onboardingByProject[trimmed] || buildDefaultOnboardingState(trimmed);
          const next = cloneState(existing);
          next.currentStep = stepId;
          next.updatedAt = new Date().toISOString();
          return {
            onboardingByProject: {
              ...prev.onboardingByProject,
              [trimmed]: next,
            },
          };
        });
      },

      setStepInput: (dbName, stepId, inputText) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const existing = prev.onboardingByProject[trimmed] || buildDefaultOnboardingState(trimmed);
          const next = cloneState(existing);
          next.steps[stepId].inputText = inputText;
          next.updatedAt = new Date().toISOString();
          return {
            onboardingByProject: {
              ...prev.onboardingByProject,
              [trimmed]: next,
            },
          };
        });
      },

      setStepProposal: (dbName, stepId, assistantMarkdown, proposalJson) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const existing = prev.onboardingByProject[trimmed] || buildDefaultOnboardingState(trimmed);
          const next = cloneState(existing);
          next.steps[stepId].assistantMarkdown = assistantMarkdown;
          next.steps[stepId].proposalJson = proposalJson;
          next.updatedAt = new Date().toISOString();
          return {
            onboardingByProject: {
              ...prev.onboardingByProject,
              [trimmed]: next,
            },
          };
        });
      },

      confirmStep: (dbName, stepId, appliedMetaIds = []) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const existing = prev.onboardingByProject[trimmed] || buildDefaultOnboardingState(trimmed);
          const next = cloneState(existing);
          const step = next.steps[stepId];
          step.status = "DONE";
          step.confirmedAt = new Date().toISOString();
          step.appliedMetaIds = Array.isArray(appliedMetaIds) ? appliedMetaIds : [];

          const n = nextStep(stepId);
          if (n) {
            if (next.steps[n].status === "LOCKED") next.steps[n].status = "READY";
            next.currentStep = n;
          }
          next.updatedAt = new Date().toISOString();

          return {
            onboardingByProject: {
              ...prev.onboardingByProject,
              [trimmed]: next,
            },
          };
        });
      },

      rollbackTo: (dbName, stepId) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const existing = prev.onboardingByProject[trimmed] || buildDefaultOnboardingState(trimmed);
          const next = cloneState(existing);
          const startIdx = ORDER.indexOf(stepId);
          if (startIdx < 0) return { onboardingByProject: prev.onboardingByProject };

          for (let i = startIdx; i < ORDER.length; i += 1) {
            const id = ORDER[i];
            next.steps[id] = {
              ...next.steps[id],
              status: i === startIdx ? "READY" : "LOCKED",
              inputText: i === startIdx ? next.steps[id].inputText : "",
              assistantMarkdown: "",
              proposalJson: null,
              confirmedAt: null,
              appliedMetaIds: [],
            };
          }
          next.currentStep = stepId;
          next.updatedAt = new Date().toISOString();
          return {
            onboardingByProject: {
              ...prev.onboardingByProject,
              [trimmed]: next,
            },
          };
        });
      },

      clearProjectOnboarding: (dbName) => {
        const trimmed = String(dbName || "").trim();
        if (!trimmed) return;
        set((prev) => {
          const next = { ...prev.onboardingByProject };
          delete next[trimmed];
          return { onboardingByProject: next };
        });
      },
    }),
    {
      name: "ontology-onboarding-storage",
      partialize: (state) => ({
        onboardingByProject: state.onboardingByProject,
      }),
    }
  )
);

