export type OnboardingStepId = "SCOPE" | "OBJECTS" | "SCENARIOS" | "ACTIONS";

export type OnboardingStepStatus = "LOCKED" | "READY" | "DONE";

export type OnboardingStepState = {
  stepId: OnboardingStepId;
  status: OnboardingStepStatus;
  inputText: string;
  assistantMarkdown: string;
  proposalJson: unknown | null;
  confirmedAt: string | null;
  appliedMetaIds: string[];
};

export type OnboardingState = {
  projectDbName: string;
  currentStep: OnboardingStepId;
  steps: Record<OnboardingStepId, OnboardingStepState>;
  updatedAt: string;
};

export function buildDefaultOnboardingState(projectDbName: string): OnboardingState {
  const now = new Date().toISOString();
  const make = (stepId: OnboardingStepId, status: OnboardingStepStatus): OnboardingStepState => ({
    stepId,
    status,
    inputText: "",
    assistantMarkdown: "",
    proposalJson: null,
    confirmedAt: null,
    appliedMetaIds: [],
  });
  return {
    projectDbName,
    currentStep: "SCOPE",
    steps: {
      SCOPE: make("SCOPE", "READY"),
      OBJECTS: make("OBJECTS", "LOCKED"),
      SCENARIOS: make("SCENARIOS", "LOCKED"),
      ACTIONS: make("ACTIONS", "LOCKED"),
    },
    updatedAt: now,
  };
}

