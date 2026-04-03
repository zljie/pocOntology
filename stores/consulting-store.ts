"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EntityScale = "S" | "M" | "L" | "XL";

export interface BusinessDomainPlan {
  id: string;
  name: string;
  description: string;
  objectTypeIds: string[];
  entityScales: Record<string, EntityScale>;
}

interface ConsultingStore {
  domains: BusinessDomainPlan[];
  selectedDomainId: string | null;
  selectDomain: (id: string | null) => void;
  addDomain: (name: string) => string;
  updateDomain: (id: string, patch: Partial<Pick<BusinessDomainPlan, "name" | "description">>) => void;
  removeDomain: (id: string) => void;
  toggleEntityInDomain: (domainId: string, objectTypeId: string) => void;
  setEntityScale: (domainId: string, objectTypeId: string, scale: EntityScale) => void;
  clear: () => void;
}

function createId() {
  const anyCrypto = globalThis.crypto as any;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `dom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useConsultingStore = create<ConsultingStore>()(
  persist(
    (set, get) => ({
      domains: [],
      selectedDomainId: null,

      selectDomain: (id) => set({ selectedDomainId: id }),

      addDomain: (name) => {
        const id = createId();
        set((state) => ({
          domains: [
            {
              id,
              name: name.trim() || "未命名业务域",
              description: "",
              objectTypeIds: [],
              entityScales: {},
            },
            ...state.domains,
          ],
        }));
        return id;
      },

      updateDomain: (id, patch) =>
        set((state) => ({
          domains: state.domains.map((d) =>
            d.id === id
              ? {
                  ...d,
                  ...patch,
                }
              : d
          ),
        })),

      removeDomain: (id) =>
        set((state) => {
          const nextSelected = state.selectedDomainId === id ? null : state.selectedDomainId;
          return {
            domains: state.domains.filter((d) => d.id !== id),
            selectedDomainId: nextSelected,
          };
        }),

      toggleEntityInDomain: (domainId, objectTypeId) =>
        set((state) => ({
          domains: state.domains.map((d) => {
            if (d.id !== domainId) return d;
            const exists = d.objectTypeIds.includes(objectTypeId);
            const nextIds = exists ? d.objectTypeIds.filter((x) => x !== objectTypeId) : [...d.objectTypeIds, objectTypeId];
            const nextScales = { ...d.entityScales };
            if (exists) {
              delete nextScales[objectTypeId];
            } else if (!nextScales[objectTypeId]) {
              nextScales[objectTypeId] = "M";
            }
            return {
              ...d,
              objectTypeIds: nextIds,
              entityScales: nextScales,
            };
          }),
        })),

      setEntityScale: (domainId, objectTypeId, scale) =>
        set((state) => ({
          domains: state.domains.map((d) =>
            d.id === domainId
              ? {
                  ...d,
                  entityScales: {
                    ...d.entityScales,
                    [objectTypeId]: scale,
                  },
                }
              : d
          ),
        })),

      clear: () =>
        set({
          domains: [],
          selectedDomainId: null,
        }),
    }),
    {
      name: "ontology-consulting-storage",
      partialize: (state) => ({
        domains: state.domains,
        selectedDomainId: state.selectedDomainId,
      }),
    }
  )
);
