import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ObjectType,
  LinkType,
  Property,
  ActionType,
  DataFlow,
  BusinessRule,
  AIModel,
  AnalysisInsight,
  SAMPLE_OBJECT_TYPES,
  SAMPLE_LINK_TYPES,
  SAMPLE_ACTION_TYPES,
  SAMPLE_DATA_FLOWS,
  SAMPLE_BUSINESS_RULES,
  SAMPLE_AI_MODELS,
  SAMPLE_ANALYSIS_INSIGHTS,
} from '@/lib/types/ontology';
import {
  ERP_OBJECT_TYPES,
  ERP_LINK_TYPES,
  ERP_ACTION_TYPES,
  ERP_DATA_FLOWS,
  ERP_BUSINESS_RULES,
  ERP_AI_MODELS,
  ERP_ANALYSIS_INSIGHTS,
} from '@/lib/types/ontology-erp-sample';
import { generateId } from '@/lib/utils';

interface OntologyStore {
  // Data
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  actionTypes: ActionType[];
  dataFlows: DataFlow[];
  businessRules: BusinessRule[];
  aiModels: AIModel[];
  analysisInsights: AnalysisInsight[];
  
  // State
  isLoading: boolean;
  lastSaved: string | null;

  // Object Type Actions
  addObjectType: (objectType: Omit<ObjectType, 'id' | 'createdAt' | 'updatedAt'>) => ObjectType;
  updateObjectType: (id: string, updates: Partial<ObjectType>) => void;
  deleteObjectType: (id: string) => void;
  getObjectType: (id: string) => ObjectType | undefined;

  // Property Actions
  addProperty: (objectTypeId: string, property: Omit<Property, 'id'>) => void;
  updateProperty: (objectTypeId: string, propertyId: string, updates: Partial<Property>) => void;
  deleteProperty: (objectTypeId: string, propertyId: string) => void;

  // Link Type Actions
  addLinkType: (linkType: Omit<LinkType, 'id' | 'createdAt' | 'updatedAt'>) => LinkType;
  updateLinkType: (id: string, updates: Partial<LinkType>) => void;
  deleteLinkType: (id: string) => void;
  getLinkType: (id: string) => LinkType | undefined;

  // Action Type Actions (Kinetic Layer)
  addActionType: (actionType: Omit<ActionType, 'id' | 'createdAt' | 'updatedAt'>) => ActionType;
  updateActionType: (id: string, updates: Partial<ActionType>) => void;
  deleteActionType: (id: string) => void;
  getActionType: (id: string) => ActionType | undefined;

  // Data Flow Actions (Kinetic Layer)
  addDataFlow: (dataFlow: Omit<DataFlow, 'id' | 'createdAt' | 'updatedAt'>) => DataFlow;
  updateDataFlow: (id: string, updates: Partial<DataFlow>) => void;
  deleteDataFlow: (id: string) => void;
  getDataFlow: (id: string) => DataFlow | undefined;

  // Business Rule Actions (Dynamic Layer)
  addBusinessRule: (rule: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt'>) => BusinessRule;
  updateBusinessRule: (id: string, updates: Partial<BusinessRule>) => void;
  deleteBusinessRule: (id: string) => void;
  getBusinessRule: (id: string) => BusinessRule | undefined;

  // AI Model Actions (Dynamic Layer)
  addAIModel: (model: Omit<AIModel, 'id' | 'createdAt' | 'updatedAt'>) => AIModel;
  updateAIModel: (id: string, updates: Partial<AIModel>) => void;
  deleteAIModel: (id: string) => void;
  getAIModel: (id: string) => AIModel | undefined;

  // Analysis Insight Actions (Dynamic Layer)
  addAnalysisInsight: (insight: Omit<AnalysisInsight, 'id' | 'createdAt' | 'updatedAt'>) => AnalysisInsight;
  updateAnalysisInsight: (id: string, updates: Partial<AnalysisInsight>) => void;
  deleteAnalysisInsight: (id: string) => void;
  getAnalysisInsight: (id: string) => AnalysisInsight | undefined;

  // Utility Actions
  loadSampleData: (scenario?: 'library' | 'erp') => void;
  clearAll: () => void;
  updateLastSaved: () => void;
}

export const useOntologyStore = create<OntologyStore>()(
  persist(
    (set, get) => ({
      // Initial state
      objectTypes: [],
      linkTypes: [],
      actionTypes: [],
      dataFlows: [],
      businessRules: [],
      aiModels: [],
      analysisInsights: [],
      isLoading: false,
      lastSaved: null,

      // ================== Object Type Actions ==================
      addObjectType: (objectType) => {
        const now = new Date().toISOString();
        const newObjectType: ObjectType = {
          ...objectType,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          objectTypes: [...state.objectTypes, newObjectType],
        }));
        return newObjectType;
      },

      updateObjectType: (id, updates) => {
        set((state) => ({
          objectTypes: state.objectTypes.map((ot) =>
            ot.id === id
              ? { ...ot, ...updates, updatedAt: new Date().toISOString() }
              : ot
          ),
        }));
      },

      deleteObjectType: (id) => {
        set((state) => ({
          objectTypes: state.objectTypes.filter((ot) => ot.id !== id),
          // Also delete associated link types
          linkTypes: state.linkTypes.filter(
            (lt) => lt.sourceTypeId !== id && lt.targetTypeId !== id
          ),
        }));
      },

      getObjectType: (id) => {
        return get().objectTypes.find((ot) => ot.id === id);
      },

      // ================== Property Actions ==================
      addProperty: (objectTypeId, property) => {
        const propertyId = generateId();
        set((state) => ({
          objectTypes: state.objectTypes.map((ot) =>
            ot.id === objectTypeId
              ? {
                  ...ot,
                  properties: [
                    ...ot.properties,
                    { ...property, id: propertyId },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : ot
          ),
        }));
      },

      updateProperty: (objectTypeId, propertyId, updates) => {
        set((state) => ({
          objectTypes: state.objectTypes.map((ot) =>
            ot.id === objectTypeId
              ? {
...ot,
                  properties: ot.properties.map((p) =>
                    p.id === propertyId ? { ...p, ...updates } : p
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : ot
          ),
        }));
      },

      deleteProperty: (objectTypeId, propertyId) => {
        set((state) => ({
          objectTypes: state.objectTypes.map((ot) =>
            ot.id === objectTypeId
              ? {
                  ...ot,
                  properties: ot.properties.filter((p) => p.id !== propertyId),
                  updatedAt: new Date().toISOString(),
                }
              : ot
          ),
        }));
      },

      // ================== Link Type Actions ==================
      addLinkType: (linkType) => {
        const now = new Date().toISOString();
        const newLinkType: LinkType = {
          ...linkType,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          linkTypes: [...state.linkTypes, newLinkType],
        }));
        return newLinkType;
      },

      updateLinkType: (id, updates) => {
        set((state) => ({
          linkTypes: state.linkTypes.map((lt) =>
            lt.id === id
              ? { ...lt, ...updates, updatedAt: new Date().toISOString() }
              : lt
          ),
        }));
      },

      deleteLinkType: (id) => {
        set((state) => ({
          linkTypes: state.linkTypes.filter((lt) => lt.id !== id),
        }));
      },

      getLinkType: (id) => {
        return get().linkTypes.find((lt) => lt.id === id);
      },

      // ================== Action Type Actions (Kinetic Layer) ==================
      addActionType: (actionType) => {
        const now = new Date().toISOString();
        const newActionType: ActionType = {
          ...actionType,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          actionTypes: [...state.actionTypes, newActionType],
        }));
        return newActionType;
      },

      updateActionType: (id, updates) => {
        set((state) => ({
          actionTypes: state.actionTypes.map((at) =>
            at.id === id
              ? { ...at, ...updates, updatedAt: new Date().toISOString() }
              : at
          ),
        }));
      },

      deleteActionType: (id) => {
        set((state) => ({
          actionTypes: state.actionTypes.filter((at) => at.id !== id),
        }));
      },

      getActionType: (id) => {
        return get().actionTypes.find((at) => at.id === id);
      },

      // ================== Data Flow Actions (Kinetic Layer) ==================
      addDataFlow: (dataFlow) => {
        const now = new Date().toISOString();
        const newDataFlow: DataFlow = {
          ...dataFlow,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          dataFlows: [...state.dataFlows, newDataFlow],
        }));
        return newDataFlow;
      },

      updateDataFlow: (id, updates) => {
        set((state) => ({
          dataFlows: state.dataFlows.map((df) =>
            df.id === id
              ? { ...df, ...updates, updatedAt: new Date().toISOString() }
              : df
          ),
        }));
      },

      deleteDataFlow: (id) => {
        set((state) => ({
          dataFlows: state.dataFlows.filter((df) => df.id !== id),
        }));
      },

      getDataFlow: (id) => {
        return get().dataFlows.find((df) => df.id === id);
      },

      // ================== Business Rule Actions (Dynamic Layer) ==================
      addBusinessRule: (rule) => {
        const now = new Date().toISOString();
        const newRule: BusinessRule = {
          ...rule,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          businessRules: [...state.businessRules, newRule],
        }));
        return newRule;
      },

      updateBusinessRule: (id, updates) => {
        set((state) => ({
          businessRules: state.businessRules.map((br) =>
            br.id === id
              ? { ...br, ...updates, updatedAt: new Date().toISOString() }
              : br
          ),
        }));
      },

      deleteBusinessRule: (id) => {
        set((state) => ({
          businessRules: state.businessRules.filter((br) => br.id !== id),
        }));
      },

      getBusinessRule: (id) => {
        return get().businessRules.find((br) => br.id === id);
      },

      // ================== AI Model Actions (Dynamic Layer) ==================
      addAIModel: (model) => {
        const now = new Date().toISOString();
        const newModel: AIModel = {
          ...model,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          aiModels: [...state.aiModels, newModel],
        }));
        return newModel;
      },

      updateAIModel: (id, updates) => {
        set((state) => ({
          aiModels: state.aiModels.map((aim) =>
            aim.id === id
              ? { ...aim, ...updates, updatedAt: new Date().toISOString() }
              : aim
          ),
        }));
      },

      deleteAIModel: (id) => {
        set((state) => ({
          aiModels: state.aiModels.filter((aim) => aim.id !== id),
        }));
      },

      getAIModel: (id) => {
        return get().aiModels.find((aim) => aim.id === id);
      },

      // ================== Analysis Insight Actions (Dynamic Layer) ==================
      addAnalysisInsight: (insight) => {
        const now = new Date().toISOString();
        const newInsight: AnalysisInsight = {
          ...insight,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          analysisInsights: [...state.analysisInsights, newInsight],
        }));
        return newInsight;
      },

      updateAnalysisInsight: (id, updates) => {
        set((state) => ({
          analysisInsights: state.analysisInsights.map((ai) =>
            ai.id === id
              ? { ...ai, ...updates, updatedAt: new Date().toISOString() }
              : ai
          ),
        }));
      },

      deleteAnalysisInsight: (id) => {
        set((state) => ({
          analysisInsights: state.analysisInsights.filter((ai) => ai.id !== id),
        }));
      },

      getAnalysisInsight: (id) => {
        return get().analysisInsights.find((ai) => ai.id === id);
      },

      // ================== Utility Actions ==================
      loadSampleData: (scenario = 'library') => {
        if (scenario === 'erp') {
          set({
            objectTypes: ERP_OBJECT_TYPES,
            linkTypes: ERP_LINK_TYPES,
            actionTypes: ERP_ACTION_TYPES,
            dataFlows: ERP_DATA_FLOWS,
            businessRules: ERP_BUSINESS_RULES,
            aiModels: ERP_AI_MODELS,
            analysisInsights: ERP_ANALYSIS_INSIGHTS,
            lastSaved: new Date().toISOString(),
          });
        } else {
          set({
            objectTypes: SAMPLE_OBJECT_TYPES,
            linkTypes: SAMPLE_LINK_TYPES,
            actionTypes: SAMPLE_ACTION_TYPES,
            dataFlows: SAMPLE_DATA_FLOWS,
            businessRules: SAMPLE_BUSINESS_RULES,
            aiModels: SAMPLE_AI_MODELS,
            analysisInsights: SAMPLE_ANALYSIS_INSIGHTS,
            lastSaved: new Date().toISOString(),
          });
        }
      },

      clearAll: () => {
        set({
          objectTypes: [],
          linkTypes: [],
          actionTypes: [],
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
          lastSaved: null,
        });
      },

      updateLastSaved: () => {
        set({ lastSaved: new Date().toISOString() });
      },
    }),
    {
      name: 'ontology-storage',
      partialize: (state) => ({
        objectTypes: state.objectTypes,
        linkTypes: state.linkTypes,
        actionTypes: state.actionTypes,
        dataFlows: state.dataFlows,
        businessRules: state.businessRules,
        aiModels: state.aiModels,
        analysisInsights: state.analysisInsights,
        lastSaved: state.lastSaved,
      }),
    }
  )
);
