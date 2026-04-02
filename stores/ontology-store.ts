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
import {
  SAP_HCM_OBJECT_TYPES,
  SAP_HCM_LINK_TYPES,
  SAP_HCM_ACTION_TYPES,
  SAP_HCM_DATA_FLOWS,
  SAP_HCM_BUSINESS_RULES,
  SAP_HCM_AI_MODELS,
  SAP_HCM_ANALYSIS_INSIGHTS,
} from '@/lib/types/ontology-sap-hcm-sample';
import { MetaCore, MetaScenario, MetaSnapshot, stableHash } from '@/lib/meta/meta-core';
import { OrmMapping } from '@/lib/orm/orm-mapping';
import { buildDefaultOrmMapping } from '@/lib/orm/postgres';
import { buildErpOrmMapping } from '@/lib/orm/erp';
import { generateId } from '@/lib/utils';

function buildOrmMapping(meta: MetaCore) {
  return meta.scenario === 'erp' ? buildErpOrmMapping(meta) : buildDefaultOrmMapping(meta);
}

interface OntologyStore {
  // Data
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  actionTypes: ActionType[];
  dataFlows: DataFlow[];
  businessRules: BusinessRule[];
  aiModels: AIModel[];
  analysisInsights: AnalysisInsight[];
  scenario: MetaScenario;
  metaSnapshots: MetaSnapshot[];
  ormMapping: OrmMapping | null;
  
  // State
  isLoading: boolean;
  lastSaved: string | null;
  neo4jProject: { dbName: string; displayName: string } | null;

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
  loadSampleData: (scenario?: 'library' | 'erp' | 'sap_hcm') => void;
  clearAll: () => void;
  updateLastSaved: () => void;
  replaceAll: (meta: MetaCore) => void;
  createMetaSnapshot: (name?: string) => MetaSnapshot;
  deleteMetaSnapshot: (id: string) => void;
  resetOrmMapping: () => void;
  updateOrmMeta: (updates: Partial<Pick<OrmMapping, 'databaseName' | 'schemaName'>>) => void;
  updateOrmTable: (objectTypeId: string, updates: Partial<OrmMapping['tables'][string]>) => void;
  updateOrmColumn: (objectTypeId: string, propertyId: string, updates: Partial<OrmMapping['tables'][string]['columns'][string]>) => void;
  updateOrmLink: (linkTypeId: string, updates: Partial<OrmMapping['links'][string]>) => void;
  setNeo4jProject: (project: { dbName: string; displayName: string } | null) => void;
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
      scenario: 'custom',
      metaSnapshots: [],
      ormMapping: buildDefaultOrmMapping({
        scenario: 'custom',
        objectTypes: [],
        linkTypes: [],
        actionTypes: [],
        dataFlows: [],
        businessRules: [],
        aiModels: [],
        analysisInsights: [],
      }),
      isLoading: false,
      lastSaved: null,
      neo4jProject: null,

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
          const meta: MetaCore = {
            scenario: 'erp',
            objectTypes: ERP_OBJECT_TYPES,
            linkTypes: ERP_LINK_TYPES,
            actionTypes: ERP_ACTION_TYPES,
            dataFlows: ERP_DATA_FLOWS,
            businessRules: ERP_BUSINESS_RULES,
            aiModels: ERP_AI_MODELS,
            analysisInsights: ERP_ANALYSIS_INSIGHTS,
          };
          const mapping = buildOrmMapping(meta);
          set({
            objectTypes: ERP_OBJECT_TYPES,
            linkTypes: ERP_LINK_TYPES,
            actionTypes: ERP_ACTION_TYPES,
            dataFlows: ERP_DATA_FLOWS,
            businessRules: ERP_BUSINESS_RULES,
            aiModels: ERP_AI_MODELS,
            analysisInsights: ERP_ANALYSIS_INSIGHTS,
            scenario: 'erp',
            ormMapping: mapping,
            lastSaved: new Date().toISOString(),
          });
        } else if (scenario === 'sap_hcm') {
          const meta: MetaCore = {
            scenario: 'sap_hcm',
            objectTypes: SAP_HCM_OBJECT_TYPES,
            linkTypes: SAP_HCM_LINK_TYPES,
            actionTypes: SAP_HCM_ACTION_TYPES,
            dataFlows: SAP_HCM_DATA_FLOWS,
            businessRules: SAP_HCM_BUSINESS_RULES,
            aiModels: SAP_HCM_AI_MODELS,
            analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
          };
          const mapping = buildOrmMapping(meta);
          mapping.databaseName = 'sap_hcm';
          mapping.schemaName = 'hcm';
          set({
            objectTypes: SAP_HCM_OBJECT_TYPES,
            linkTypes: SAP_HCM_LINK_TYPES,
            actionTypes: SAP_HCM_ACTION_TYPES,
            dataFlows: SAP_HCM_DATA_FLOWS,
            businessRules: SAP_HCM_BUSINESS_RULES,
            aiModels: SAP_HCM_AI_MODELS,
            analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
            scenario: 'sap_hcm',
            ormMapping: mapping,
            lastSaved: new Date().toISOString(),
          });
        } else {
          const meta: MetaCore = {
            scenario: 'library',
            objectTypes: SAMPLE_OBJECT_TYPES,
            linkTypes: SAMPLE_LINK_TYPES,
            actionTypes: SAMPLE_ACTION_TYPES,
            dataFlows: SAMPLE_DATA_FLOWS,
            businessRules: SAMPLE_BUSINESS_RULES,
            aiModels: SAMPLE_AI_MODELS,
            analysisInsights: SAMPLE_ANALYSIS_INSIGHTS,
          };
          const mapping = buildOrmMapping(meta);
          set({
            objectTypes: SAMPLE_OBJECT_TYPES,
            linkTypes: SAMPLE_LINK_TYPES,
            actionTypes: SAMPLE_ACTION_TYPES,
            dataFlows: SAMPLE_DATA_FLOWS,
            businessRules: SAMPLE_BUSINESS_RULES,
            aiModels: SAMPLE_AI_MODELS,
            analysisInsights: SAMPLE_ANALYSIS_INSIGHTS,
            scenario: 'library',
            ormMapping: mapping,
            lastSaved: new Date().toISOString(),
          });
        }
      },

      clearAll: () => {
        const meta: MetaCore = {
          scenario: 'custom',
          objectTypes: [],
          linkTypes: [],
          actionTypes: [],
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
        };
        set({
          objectTypes: [],
          linkTypes: [],
          actionTypes: [],
          dataFlows: [],
          businessRules: [],
          aiModels: [],
          analysisInsights: [],
          scenario: 'custom',
          ormMapping: buildOrmMapping(meta),
          lastSaved: null,
        });
      },

      updateLastSaved: () => {
        set({ lastSaved: new Date().toISOString() });
      },

      setNeo4jProject: (project) => {
        set({ neo4jProject: project });
      },

      replaceAll: (meta) => {
        const core: MetaCore = {
          scenario: meta.scenario || 'custom',
          objectTypes: meta.objectTypes || [],
          linkTypes: meta.linkTypes || [],
          actionTypes: meta.actionTypes || [],
          dataFlows: meta.dataFlows || [],
          businessRules: meta.businessRules || [],
          aiModels: meta.aiModels || [],
          analysisInsights: meta.analysisInsights || [],
        };
        set({
          objectTypes: meta.objectTypes || [],
          linkTypes: meta.linkTypes || [],
          actionTypes: meta.actionTypes || [],
          dataFlows: meta.dataFlows || [],
          businessRules: meta.businessRules || [],
          aiModels: meta.aiModels || [],
          analysisInsights: meta.analysisInsights || [],
          scenario: meta.scenario || 'custom',
          ormMapping: buildOrmMapping(core),
          lastSaved: new Date().toISOString(),
        });
      },

      createMetaSnapshot: (name) => {
        const now = new Date().toISOString();
        const meta: MetaCore = {
          scenario: get().scenario,
          objectTypes: get().objectTypes,
          linkTypes: get().linkTypes,
          actionTypes: get().actionTypes,
          dataFlows: get().dataFlows,
          businessRules: get().businessRules,
          aiModels: get().aiModels,
          analysisInsights: get().analysisInsights,
        };
        const snapshot: MetaSnapshot = {
          id: generateId(),
          name: name?.trim() ? name.trim() : `snapshot-${now.slice(0, 19)}`,
          createdAt: now,
          scenario: meta.scenario,
          metaHash: stableHash(meta),
          meta,
        };
        set((state) => ({
          metaSnapshots: [snapshot, ...state.metaSnapshots].slice(0, 20),
        }));
        return snapshot;
      },

      deleteMetaSnapshot: (id) => {
        set((state) => ({
          metaSnapshots: state.metaSnapshots.filter((s) => s.id !== id),
        }));
      },

      resetOrmMapping: () => {
        const meta: MetaCore = {
          scenario: get().scenario,
          objectTypes: get().objectTypes,
          linkTypes: get().linkTypes,
          actionTypes: get().actionTypes,
          dataFlows: get().dataFlows,
          businessRules: get().businessRules,
          aiModels: get().aiModels,
          analysisInsights: get().analysisInsights,
        };
        set({ ormMapping: buildOrmMapping(meta) });
      },

      updateOrmMeta: (updates) => {
        set((state) => {
          if (!state.ormMapping) return state as any;
          return { ormMapping: { ...state.ormMapping, ...updates } } as any;
        });
      },

      updateOrmTable: (objectTypeId, updates) => {
        set((state) => {
          if (!state.ormMapping) return state as any;
          const next = { ...state.ormMapping, tables: { ...state.ormMapping.tables } };
          const cur = next.tables[objectTypeId];
          if (!cur) return state as any;
          next.tables[objectTypeId] = { ...cur, ...updates };
          return { ormMapping: next } as any;
        });
      },

      updateOrmColumn: (objectTypeId, propertyId, updates) => {
        set((state) => {
          if (!state.ormMapping) return state as any;
          const next = { ...state.ormMapping, tables: { ...state.ormMapping.tables } };
          const cur = next.tables[objectTypeId];
          if (!cur) return state as any;
          const columns = { ...cur.columns };
          const col = columns[propertyId];
          if (!col) return state as any;
          columns[propertyId] = { ...col, ...updates };
          next.tables[objectTypeId] = { ...cur, columns };
          return { ormMapping: next } as any;
        });
      },

      updateOrmLink: (linkTypeId, updates) => {
        set((state) => {
          if (!state.ormMapping) return state as any;
          const next = { ...state.ormMapping, links: { ...state.ormMapping.links } };
          const cur = next.links[linkTypeId];
          if (!cur) return state as any;
          next.links[linkTypeId] = { ...cur, ...updates };
          return { ormMapping: next } as any;
        });
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
        scenario: state.scenario,
        metaSnapshots: state.metaSnapshots,
        ormMapping: state.ormMapping,
        lastSaved: state.lastSaved,
        neo4jProject: state.neo4jProject,
      }),
    }
  )
);
