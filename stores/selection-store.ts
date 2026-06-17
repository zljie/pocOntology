import { create } from 'zustand';
import { OntologyLayer } from '@/lib/types/ontology';

interface SelectionStore {
  // Layer filter
  selectedLayer: OntologyLayer | 'ALL';
  
  // Entity selections
  selectedObjectTypeId: string | null;
  selectedLinkTypeId: string | null;
  selectedPropertyId: string | null;
  selectedActionTypeId: string | null;
  selectedDataFlowId: string | null;
  selectedBusinessRuleId: string | null;
  selectedAIModelId: string | null;
  selectedAnalysisInsightId: string | null;
  
  // Graph selections
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  semanticHighlightedNodeIds: string[];
  semanticHighlightedEdgeIds: string[];
  semanticQueryPreview:
    | {
        query: string;
        generatedAt: string;
        semanticScenario?: string;
        rdf: string;
        owl?: string;
        swrl: string;
        dsl?: string;
        graphqlTemplate?: string;
        templateVars?: Record<string, string>;
        sql?: string;
        sqlVars?: Record<string, string>;
        schemaVersion?: string;
        reasoning?: string;
        source?: "rule" | "llm";
      }
    | null;
  semanticParsedResult: any | null;
  semanticResourcePreview: {
    resources: { name: string; type: string; description: string }[];
    dataStructures: { name: string; fields: { name: string; type: string; description: string }[] }[];
    status: "idle" | "running" | "done" | "error";
  } | null;

  // Selection Actions
  selectLayer: (layer: OntologyLayer | 'ALL') => void;
  selectObjectType: (id: string | null) => void;
  selectLinkType: (id: string | null) => void;
  selectProperty: (id: string | null) => void;
  selectActionType: (id: string | null) => void;
  selectDataFlow: (id: string | null) => void;
  selectBusinessRule: (id: string | null) => void;
  selectAIModel: (id: string | null) => void;
  selectAnalysisInsight: (id: string | null) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSemanticHighlightedNodeIds: (ids: string[]) => void;
  clearSemanticHighlightedNodeIds: () => void;
  setSemanticHighlightedEdgeIds: (ids: string[]) => void;
  clearSemanticHighlightedEdgeIds: () => void;
  setSemanticQueryPreview: (preview: {
    query: string;
    generatedAt: string;
    semanticScenario?: string;
    rdf: string;
    owl?: string;
    swrl: string;
    dsl?: string;
    graphqlTemplate?: string;
    templateVars?: Record<string, string>;
    sql?: string;
    sqlVars?: Record<string, string>;
    schemaVersion?: string;
    reasoning?: string;
    source?: "rule" | "llm";
  }) => void;
  clearSemanticQueryPreview: () => void;
  setSemanticParsedResult: (result: any | null) => void;
  setSemanticResourcePreview: (preview: {
    resources: { name: string; type: string; description: string }[];
    dataStructures: { name: string; fields: { name: string; type: string; description: string }[] }[];
    status: "idle" | "running" | "done" | "error";
  } | null) => void;
  clearSelection: () => void;
  clearAll: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  // Initial state
  selectedLayer: 'ALL',
  selectedObjectTypeId: null,
  selectedLinkTypeId: null,
  selectedPropertyId: null,
  selectedActionTypeId: null,
  selectedDataFlowId: null,
  selectedBusinessRuleId: null,
  selectedAIModelId: null,
  selectedAnalysisInsightId: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  semanticHighlightedNodeIds: [],
  semanticHighlightedEdgeIds: [],
  semanticQueryPreview: null,
  semanticParsedResult: null,
  semanticResourcePreview: null,

  // Layer selection
  selectLayer: (layer) =>
    set({
      selectedLayer: layer,
      // Clear all entity selections when changing layer
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  // Entity selections
  selectObjectType: (id) =>
    set({
      selectedObjectTypeId: id,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  selectLinkType: (id) =>
    set({
      selectedLinkTypeId: id,
      selectedObjectTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  selectProperty: (id) =>
    set({
      selectedPropertyId: id,
    }),

  selectActionType: (id) =>
    set({
      selectedActionTypeId: id,
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  selectDataFlow: (id) =>
    set({
      selectedDataFlowId: id,
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  selectBusinessRule: (id) =>
    set({
      selectedBusinessRuleId: id,
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
    }),

  selectAIModel: (id) =>
    set({
      selectedAIModelId: id,
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAnalysisInsightId: null,
    }),

  selectAnalysisInsight: (id) =>
    set({
      selectedAnalysisInsightId: id,
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
    }),

  selectNode: (id) =>
    set({
      selectedNodeId: id,
    }),

  selectEdge: (id) =>
    set({
      selectedEdgeId: id,
    }),

  setSemanticHighlightedNodeIds: (ids) =>
    set({
      semanticHighlightedNodeIds: ids,
    }),

  clearSemanticHighlightedNodeIds: () =>
    set({
      semanticHighlightedNodeIds: [],
    }),

  setSemanticHighlightedEdgeIds: (ids) =>
    set({
      semanticHighlightedEdgeIds: ids,
    }),

  clearSemanticHighlightedEdgeIds: () =>
    set({
      semanticHighlightedEdgeIds: [],
    }),

  setSemanticQueryPreview: (preview) =>
    set({
      semanticQueryPreview: preview,
    }),

  clearSemanticQueryPreview: () =>
    set({
      semanticQueryPreview: null,
    }),

  setSemanticParsedResult: (result) =>
    set({
      semanticParsedResult: result,
    }),

  setSemanticResourcePreview: (preview) =>
    set({
      semanticResourcePreview: preview,
    }),

  clearSelection: () =>
    set({
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
      semanticHighlightedNodeIds: [],
      semanticHighlightedEdgeIds: [],
      semanticQueryPreview: null,
      semanticParsedResult: null,
      semanticResourcePreview: null,
    }),

  clearAll: () =>
    set({
      selectedLayer: 'ALL',
      selectedObjectTypeId: null,
      selectedLinkTypeId: null,
      selectedPropertyId: null,
      selectedActionTypeId: null,
      selectedDataFlowId: null,
      selectedBusinessRuleId: null,
      selectedAIModelId: null,
      selectedAnalysisInsightId: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      semanticHighlightedNodeIds: [],
      semanticHighlightedEdgeIds: [],
      semanticQueryPreview: null,
      semanticParsedResult: null,
      semanticResourcePreview: null,
    }),
}));
