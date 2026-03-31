"use client";

import React, { useState } from "react";
import {
  Database,
  Zap,
  Brain,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  FileText,
  Package,
  User,
  BookOpen,
  MapPin,
  ClipboardList,
  CalendarClock,
  ShoppingCart,
  Truck,
  Wallet,
  Building,
  AlertCircle,
  Building2,
  Briefcase,
  Tag,
  Newspaper,
  type LucideIcon,
  Settings,
  Play,
  BarChart3,
  Sparkles,
  GitBranch,
  ArrowRight,
  Shield,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { OntologyLayer, ONTOLOGY_LAYER_INFO } from "@/lib/types/ontology";
import { cn } from "@/lib/utils";
import { CreateObjectTypeDialog } from "@/components/object-type-manager/create-object-type-dialog";
import { CreateLinkTypeDialog } from "@/components/object-type-manager/create-link-type-dialog";
import {
  CreateActionTypeDialog,
  CreateDataFlowDialog,
  CreateBusinessRuleDialog,
  CreateAIModelDialog,
  CreateAnalysisInsightDialog,
} from "@/components/ontology-layers/create-entity-dialogs";
import { EntityTypeAIAssistantDrawer } from "@/components/ontology-layers/entity-type-ai-assistant-drawer";
import { ActionTypeAIAssistantDrawer } from "@/components/ontology-layers/action-type-ai-assistant-drawer";
import { LinkTypeAIAssistantDrawer } from "@/components/ontology-layers/link-type-ai-assistant-drawer";

// Icon maps for different entity types
const objectTypeIcons: Record<string, LucideIcon> = {
  User,
  BookOpen,
  MapPin,
  ClipboardList,
  CalendarClock,
  ShoppingCart,
  Truck,
  Wallet,
  Building,
  AlertCircle,
  Building2,
  Briefcase,
  Tag,
  Newspaper,
  FileText,
};

const layerColors: Record<OntologyLayer, string> = {
  SEMANTIC: "#3B82F6",
  KINETIC: "#10B981",
  DYNAMIC: "#F59E0B",
};

export function OntologyLayerPanel() {
  const [activeTab, setActiveTab] = useState<OntologyLayer>("SEMANTIC");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLinkDialogOpen, setCreateLinkDialogOpen] = useState(false);
  const [createActionDialogOpen, setCreateActionDialogOpen] = useState(false);
  const [createDataFlowDialogOpen, setCreateDataFlowDialogOpen] = useState(false);
  const [createBusinessRuleDialogOpen, setCreateBusinessRuleDialogOpen] = useState(false);
  const [createAIModelDialogOpen, setCreateAIModelDialogOpen] = useState(false);
  const [createAnalysisInsightDialogOpen, setCreateAnalysisInsightDialogOpen] = useState(false);
  const [entityAIDrawerOpen, setEntityAIDrawerOpen] = useState(false);
  const [actionAIDrawerOpen, setActionAIDrawerOpen] = useState(false);
  const [linkAIDrawerOpen, setLinkAIDrawerOpen] = useState(false);

  const {
    objectTypes,
    linkTypes,
    actionTypes,
    dataFlows,
    businessRules,
    aiModels,
    analysisInsights,
    deleteObjectType,
    deleteLinkType,
    deleteActionType,
    deleteDataFlow,
    deleteBusinessRule,
    deleteAIModel,
    deleteAnalysisInsight,
  } = useOntologyStore();

  const {
    selectedLayer,
    selectedObjectTypeId,
    selectedLinkTypeId,
    selectedActionTypeId,
    selectedDataFlowId,
    selectedBusinessRuleId,
    selectedAIModelId,
    selectedAnalysisInsightId,
    selectLayer,
    selectObjectType,
    selectLinkType,
    selectActionType,
    selectDataFlow,
    selectBusinessRule,
    selectAIModel,
    selectAnalysisInsight,
  } = useSelectionStore();

  const { openRightPanel } = useUIStore();

  const handleTabChange = (value: string) => {
    const layer = value as OntologyLayer;
    setActiveTab(layer);
    selectLayer(layer);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCounts = () => ({
    SEMANTIC: objectTypes.filter((ot) => ot.layer === "SEMANTIC").length,
    KINETIC: actionTypes.length + dataFlows.length,
    DYNAMIC: businessRules.length + aiModels.length + analysisInsights.length,
  });

  const counts = getCounts();

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Layer Tabs */}
      <div className="border-b border-[#2d2d2d]">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="w-full bg-transparent h-auto p-0 rounded-none">
            <TabsTrigger
              value="SEMANTIC"
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-none border-b-2 border-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:border-[#3B82F6] data-[state=active]:text-[#3B82F6]",
                "text-[#6b6b6b] hover:text-[#a0a0a0] transition-colors"
              )}
            >
              <Database className="w-4 h-4" />
              <span className="text-xs font-medium">语义层</span>
              <Badge
                variant="outline"
                className="ml-1 text-[10px] px-1.5 py-0 border-[#3B82F6]/30 text-[#3B82F6]"
              >
                {counts.SEMANTIC}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="KINETIC"
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-none border-b-2 border-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:border-[#10B981] data-[state=active]:text-[#10B981]",
                "text-[#6b6b6b] hover:text-[#a0a0a0] transition-colors"
              )}
            >
              <Zap className="w-4 h-4" />
              <span className="text-xs font-medium">动势层</span>
              <Badge
                variant="outline"
                className="ml-1 text-[10px] px-1.5 py-0 border-[#10B981]/30 text-[#10B981]"
              >
                {counts.KINETIC}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="DYNAMIC"
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-none border-b-2 border-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:border-[#F59E0B] data-[state=active]:text-[#F59E0B]",
                "text-[#6b6b6b] hover:text-[#a0a0a0] transition-colors"
              )}
            >
              <Brain className="w-4 h-4" />
              <span className="text-xs font-medium">动态层</span>
              <Badge
                variant="outline"
                className="ml-1 text-[10px] px-1.5 py-0 border-[#F59E0B]/30 text-[#F59E0B]"
              >
                {counts.DYNAMIC}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-[#2d2d2d]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b6b]" />
          <Input
            placeholder={`搜索${activeTab === "SEMANTIC" ? "对象类型/关系" : activeTab === "KINETIC" ? "操作/数据流" : "规则/模型/洞察"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-[#1a1a1a] border-[#2d2d2d] focus:border-[#5b8def]"
          />
        </div>
      </div>

      {/* Content based on active layer */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {activeTab === "SEMANTIC" && (
            <SemanticLayerContent
              objectTypes={objectTypes.filter(
                (ot) =>
                  ot.layer === "SEMANTIC" &&
                  (ot.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ot.apiName.toLowerCase().includes(searchQuery.toLowerCase()))
              )}
              linkTypes={linkTypes.filter(
                (lt) =>
                  lt.layer === "SEMANTIC" &&
                  (lt.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    lt.apiName.toLowerCase().includes(searchQuery.toLowerCase()))
              )}
              selectedObjectTypeId={selectedObjectTypeId}
              selectedLinkTypeId={selectedLinkTypeId}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onSelectObjectType={(id) => {
                selectObjectType(id);
                openRightPanel();
              }}
              onDeleteObjectType={deleteObjectType}
              onSelectLinkType={(id) => {
                selectObjectType(null);
                selectLinkType(id);
                openRightPanel();
              }}
              onDeleteLinkType={deleteLinkType}
              onOpenCreateObjectDialog={() => setCreateDialogOpen(true)}
              onOpenCreateLinkDialog={() => setCreateLinkDialogOpen(true)}
              onOpenAIAssistant={() => setEntityAIDrawerOpen(true)}
              onOpenLinkAIAssistant={() => setLinkAIDrawerOpen(true)}
            />
          )}

          {activeTab === "KINETIC" && (
            <KineticLayerContent
              actionTypes={actionTypes.filter(
                (at) =>
                  at.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  at.apiName.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              dataFlows={dataFlows.filter(
                (df) =>
                  df.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  df.apiName.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              selectedActionTypeId={selectedActionTypeId}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onSelectActionType={(id) => {
                selectActionType(id);
                openRightPanel();
              }}
              onSelectDataFlow={(id) => {
                selectDataFlow(id);
                openRightPanel();
              }}
              onDeleteActionType={deleteActionType}
              onDeleteDataFlow={deleteDataFlow}
              onOpenCreateActionDialog={() => setCreateActionDialogOpen(true)}
              onOpenCreateDataFlowDialog={() => setCreateDataFlowDialogOpen(true)}
              onOpenActionAIAssistant={() => setActionAIDrawerOpen(true)}
            />
          )}

          {activeTab === "DYNAMIC" && (
            <DynamicLayerContent
              businessRules={businessRules.filter(
                (br) =>
                  br.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  br.apiName.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              aiModels={aiModels.filter(
                (aim) =>
                  aim.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  aim.apiName.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              analysisInsights={analysisInsights.filter(
                (ai) =>
                  ai.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  ai.apiName.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              selectedBusinessRuleId={selectedBusinessRuleId}
              selectedAIModelId={selectedAIModelId}
              selectedAnalysisInsightId={selectedAnalysisInsightId}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onSelectBusinessRule={(id) => {
                selectBusinessRule(id);
                openRightPanel();
              }}
              onSelectAIModel={(id) => {
                selectAIModel(id);
                openRightPanel();
              }}
              onSelectAnalysisInsight={(id) => {
                selectAnalysisInsight(id);
                openRightPanel();
              }}
              onDeleteBusinessRule={deleteBusinessRule}
              onDeleteAIModel={deleteAIModel}
              onDeleteAnalysisInsight={deleteAnalysisInsight}
              onOpenCreateBusinessRuleDialog={() => setCreateBusinessRuleDialogOpen(true)}
              onOpenCreateAIModelDialog={() => setCreateAIModelDialogOpen(true)}
              onOpenCreateAnalysisInsightDialog={() => setCreateAnalysisInsightDialogOpen(true)}
            />
          )}
        </div>
      </ScrollArea>

      {/* Create Dialog */}
      <CreateObjectTypeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <CreateLinkTypeDialog
        open={createLinkDialogOpen}
        onOpenChange={setCreateLinkDialogOpen}
      />
      <CreateActionTypeDialog
        open={createActionDialogOpen}
        onOpenChange={setCreateActionDialogOpen}
      />
      <CreateDataFlowDialog
        open={createDataFlowDialogOpen}
        onOpenChange={setCreateDataFlowDialogOpen}
      />
      <CreateBusinessRuleDialog
        open={createBusinessRuleDialogOpen}
        onOpenChange={setCreateBusinessRuleDialogOpen}
      />
      <CreateAIModelDialog
        open={createAIModelDialogOpen}
        onOpenChange={setCreateAIModelDialogOpen}
      />
      <CreateAnalysisInsightDialog
        open={createAnalysisInsightDialogOpen}
        onOpenChange={setCreateAnalysisInsightDialogOpen}
      />
      <EntityTypeAIAssistantDrawer
        open={entityAIDrawerOpen}
        onOpenChange={setEntityAIDrawerOpen}
      />
      <ActionTypeAIAssistantDrawer
        open={actionAIDrawerOpen}
        onOpenChange={setActionAIDrawerOpen}
      />
      <LinkTypeAIAssistantDrawer
        open={linkAIDrawerOpen}
        onOpenChange={setLinkAIDrawerOpen}
      />
    </div>
  );
}

// ==================== Semantic Layer Content ====================
interface SemanticLayerContentProps {
  objectTypes: any[];
  linkTypes: any[];
  selectedObjectTypeId: string | null;
  selectedLinkTypeId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectObjectType: (id: string) => void;
  onDeleteObjectType: (id: string) => void;
  onSelectLinkType: (id: string) => void;
  onDeleteLinkType: (id: string) => void;
  onOpenCreateObjectDialog: () => void;
  onOpenCreateLinkDialog: () => void;
  onOpenAIAssistant: () => void;
  onOpenLinkAIAssistant: () => void;
}

function SemanticLayerContent({
  objectTypes,
  linkTypes,
  selectedObjectTypeId,
  selectedLinkTypeId,
  expandedIds,
  onToggleExpand,
  onSelectObjectType,
  onDeleteObjectType,
  onSelectLinkType,
  onDeleteLinkType,
  onOpenCreateObjectDialog,
  onOpenCreateLinkDialog,
  onOpenAIAssistant,
  onOpenLinkAIAssistant,
}: SemanticLayerContentProps) {
  const objectTypeMap = new Map(objectTypes.map((ot) => [ot.id, ot]));

  return (
    <div className="space-y-4">
      {/* Object Types Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <Database className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">实体类型</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {objectTypes.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateObjectDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={onOpenAIAssistant}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#8B5CF6]" />
                AI 辅助
              </Button>
            </TooltipTrigger>
            <TooltipContent>三步引导生成对象类型与属性</TooltipContent>
          </Tooltip>
        </div>

        {objectTypes.length === 0 ? (
          <EmptyState
            icon={Database}
            message="暂无实体类型"
            description="点击上方按钮创建第一个实体类型"
          />
        ) : (
          <div className="space-y-1">
            {objectTypes.map((objectType) => {
              const Icon =
                objectTypeIcons[objectType.icon || ""] || FileText;
              const isSelected = selectedObjectTypeId === objectType.id;
              const isExpanded = expandedIds.has(objectType.id);

              return (
                <div key={objectType.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                      isSelected
                        ? "bg-[#3B82F6]/10 border border-[#3B82F6]/30"
                        : "hover:bg-[#2d2d2d] border border-transparent"
                    )}
                    onClick={() => onSelectObjectType(objectType.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(objectType.id);
                      }}
                      className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      )}
                    </button>

                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#3B82F6]/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#3B82F6]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {objectType.displayName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono"
                        >
                          {objectType.category || "ENTITY"}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-[#6b6b6b] font-mono">
                        {objectType.apiName}
                      </span>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="text-[11px] text-[#6b6b6b]">
                        {objectType.properties.length} 属性
                      </span>

                      <EntityActions
                        onDelete={() => onDeleteObjectType(objectType.id)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                      <div className="space-y-1 py-1">
                        {objectType.properties.slice(0, 5).map((prop: any) => (
                          <div
                            key={prop.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2d2d2d]"
                          >
                            <Package className="w-3 h-3 text-[#6b6b6b]" />
                            <span className="text-xs text-white">
                              {prop.displayName}
                            </span>
                            <span className="text-[10px] text-[#6b6b6b] font-mono ml-auto">
                              {prop.baseType}
                            </span>
                          </div>
                        ))}
                        {objectType.properties.length > 5 && (
                          <div className="text-[10px] text-[#6b6b6b] px-2 py-1">
                            +{objectType.properties.length - 5} more...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Types Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <GitBranch className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">关系类型</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {linkTypes.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateLinkDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={onOpenLinkAIAssistant}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#8B5CF6]" />
                AI 辅助
              </Button>
            </TooltipTrigger>
            <TooltipContent>推导关系并一键生成</TooltipContent>
          </Tooltip>
        </div>

        {linkTypes.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            message="暂无关系类型"
            description="在画布上拖拽创建关系，或点击上方 + 号新建"
          />
        ) : (
          <div className="space-y-1">
            {linkTypes.map((linkType) => {
              const sourceType = objectTypeMap.get(linkType.sourceTypeId);
              const targetType = objectTypeMap.get(linkType.targetTypeId);

              return (
                <div
                key={linkType.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-[#2d2d2d] border border-transparent transition-colors",
                  selectedLinkTypeId === linkType.id && "bg-[#3B82F6]/10 border-[#3B82F6]/30"
                )}
                onClick={() => onSelectLinkType(linkType.id)}
              >
                <ArrowRight className="w-3.5 h-3.5 text-[#3B82F6] flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {linkType.displayName}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 font-mono"
                    >
                      {linkType.cardinality}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#6b6b6b] mt-0.5">
                    <span className="font-mono truncate max-w-[80px]">
                      {sourceType?.displayName || "?"}
                    </span>
                    <span>→</span>
                    <span className="font-mono truncate max-w-[80px]">
                      {targetType?.displayName || "?"}
                    </span>
                  </div>
                </div>

                <EntityActions onDelete={() => onDeleteLinkType(linkType.id)} />
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Kinetic Layer Content ====================
interface KineticLayerContentProps {
  actionTypes: any[];
  dataFlows: any[];
  selectedActionTypeId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectActionType: (id: string) => void;
  onSelectDataFlow: (id: string) => void;
  onDeleteActionType: (id: string) => void;
  onDeleteDataFlow: (id: string) => void;
  onOpenCreateActionDialog: () => void;
  onOpenCreateDataFlowDialog: () => void;
  onOpenActionAIAssistant: () => void;
}

function KineticLayerContent({
  actionTypes,
  dataFlows,
  selectedActionTypeId,
  expandedIds,
  onToggleExpand,
  onSelectActionType,
  onSelectDataFlow,
  onDeleteActionType,
  onDeleteDataFlow,
  onOpenCreateActionDialog,
  onOpenCreateDataFlowDialog,
  onOpenActionAIAssistant,
}: KineticLayerContentProps) {
  return (
    <div className="space-y-4">
      {/* Action Types Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">操作类型</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {actionTypes.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateActionDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={onOpenActionAIAssistant}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#8B5CF6]" />
                AI 辅助
              </Button>
            </TooltipTrigger>
            <TooltipContent>两轮沟通生成 CRUD 动作</TooltipContent>
          </Tooltip>
        </div>

        {actionTypes.length === 0 ? (
          <EmptyState
            icon={Zap}
            message="暂无操作类型"
            description="创建业务操作来定义系统行为"
          />
        ) : (
          <div className="space-y-1">
            {actionTypes.map((actionType) => {
              const isSelected = selectedActionTypeId === actionType.id;
              const isExpanded = expandedIds.has(actionType.id);

              return (
                <div key={actionType.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                      isSelected
                        ? "bg-[#10B981]/10 border border-[#10B981]/30"
                        : "hover:bg-[#2d2d2d] border border-transparent"
                    )}
                    onClick={() => onSelectActionType(actionType.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(actionType.id);
                      }}
                      className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      )}
                    </button>

                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `${actionType.color || "#10B981"}20` }}
                    >
                      <Play className="w-4 h-4 text-[#10B981]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {actionType.displayName}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6b6b6b] font-mono">
                        {actionType.apiName}
                      </span>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="text-[11px] text-[#6b6b6b]">
                        {actionType.affectedObjectTypeIds?.length || 0} 实体
                      </span>

                      <EntityActions
                        onDelete={() => onDeleteActionType(actionType.id)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                      <div className="space-y-2 py-1">
                        {actionType.description && (
                          <p className="text-[11px] text-[#6b6b6b] px-2">
                            {actionType.description}
                          </p>
                        )}
                        {actionType.triggerConditions?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-medium text-[#10B981] px-2">
                              触发条件
                            </span>
                            <div className="space-y-1 mt-1">
                              {actionType.triggerConditions.map(
                                (tc: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 px-2 py-1 bg-[#1a1a1a] rounded"
                                  >
                                    <Settings className="w-3 h-3 text-[#6b6b6b]" />
                                    <span className="text-[11px] text-white font-mono">
                                      {tc.condition}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {actionType.inputParameters?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-medium text-[#6b6b6b] px-2">
                              输入参数
                            </span>
                            <div className="space-y-1 mt-1">
                              {actionType.inputParameters.map(
                                (param: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 px-2 py-1"
                                  >
                                    <Package className="w-3 h-3 text-[#6b6b6b]" />
                                    <span className="text-[11px] text-white">
                                      {param.displayName}
                                    </span>
                                    <span className="text-[10px] text-[#6b6b6b] font-mono ml-auto">
                                      {param.baseType}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Flows Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <GitBranch className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">数据流</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {dataFlows.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateDataFlowDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {dataFlows.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            message="暂无数据流"
            description="创建业务流程数据流"
          />
        ) : (
          <div className="space-y-1">
            {dataFlows.map((dataFlow) => (
              <div
                key={dataFlow.id}
                className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-[#2d2d2d] border border-transparent transition-colors"
                onClick={() => onSelectDataFlow(dataFlow.id)}
              >
                <ArrowRight className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white truncate">
                    {dataFlow.displayName}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-[#6b6b6b] mt-0.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 border-[#10B981]/30 text-[#10B981]"
                    >
                      {dataFlow.flowDirection}
                    </Badge>
                    <span>{dataFlow.steps?.length || 0} 步骤</span>
                  </div>
                </div>

                <EntityActions onDelete={() => onDeleteDataFlow(dataFlow.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Dynamic Layer Content ====================
interface DynamicLayerContentProps {
  businessRules: any[];
  aiModels: any[];
  analysisInsights: any[];
  selectedBusinessRuleId: string | null;
  selectedAIModelId: string | null;
  selectedAnalysisInsightId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectBusinessRule: (id: string) => void;
  onSelectAIModel: (id: string) => void;
  onSelectAnalysisInsight: (id: string) => void;
  onDeleteBusinessRule: (id: string) => void;
  onDeleteAIModel: (id: string) => void;
  onDeleteAnalysisInsight: (id: string) => void;
  onOpenCreateBusinessRuleDialog: () => void;
  onOpenCreateAIModelDialog: () => void;
  onOpenCreateAnalysisInsightDialog: () => void;
}

function DynamicLayerContent({
  businessRules,
  aiModels,
  analysisInsights,
  selectedBusinessRuleId,
  selectedAIModelId,
  selectedAnalysisInsightId,
  expandedIds,
  onToggleExpand,
  onSelectBusinessRule,
  onSelectAIModel,
  onSelectAnalysisInsight,
  onDeleteBusinessRule,
  onDeleteAIModel,
  onDeleteAnalysisInsight,
  onOpenCreateBusinessRuleDialog,
  onOpenCreateAIModelDialog,
  onOpenCreateAnalysisInsightDialog,
}: DynamicLayerContentProps) {
  return (
    <div className="space-y-4">
      {/* Business Rules Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">业务规则</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {businessRules.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateBusinessRuleDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {businessRules.length === 0 ? (
          <EmptyState
            icon={Shield}
            message="暂无业务规则"
            description="创建业务约束和验证规则"
          />
        ) : (
          <div className="space-y-1">
            {businessRules.map((rule) => {
              const isSelected = selectedBusinessRuleId === rule.id;
              const isExpanded = expandedIds.has(rule.id);

              return (
                <div key={rule.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                      isSelected
                        ? "bg-[#F59E0B]/10 border border-[#F59E0B]/30"
                        : "hover:bg-[#2d2d2d] border border-transparent"
                    )}
                    onClick={() => onSelectBusinessRule(rule.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(rule.id);
                      }}
                      className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      )}
                    </button>

                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#F59E0B]/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-[#F59E0B]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {rule.displayName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-mono",
                            rule.enabled
                              ? "border-green-500/30 text-green-400"
                              : "border-red-500/30 text-red-400"
                          )}
                        >
                          {rule.enabled ? "启用" : "禁用"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#6b6b6b]">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-[#F59E0B]/30 text-[#F59E0B]"
                        >
                          {rule.ruleType}
                        </Badge>
                        <span>优先级: {rule.priority}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <EntityActions
                        onDelete={() => onDeleteBusinessRule(rule.id)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                      <div className="space-y-2 py-1">
                        {rule.description && (
                          <p className="text-[11px] text-[#6b6b6b] px-2">
                            {rule.description}
                          </p>
                        )}
                        {rule.expression && (
                          <div className="px-2 py-1.5 bg-[#1a1a1a] rounded font-mono text-[11px] text-[#10B981]">
                            {rule.expression}
                          </div>
                        )}
                        {rule.onViolation && (
                          <div className="flex items-center gap-2 px-2">
                            <AlertCircle className="w-3 h-3 text-[#EF4444]" />
                            <span className="text-[11px] text-white">
                              {rule.onViolation.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Models Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">AI 模型</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {aiModels.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateAIModelDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {aiModels.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            message="暂无 AI 模型"
            description="创建智能推荐和预测模型"
          />
        ) : (
          <div className="space-y-1">
            {aiModels.map((model) => {
              const isSelected = selectedAIModelId === model.id;
              const isExpanded = expandedIds.has(model.id);

              return (
                <div key={model.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                      isSelected
                        ? "bg-[#F59E0B]/10 border border-[#F59E0B]/30"
                        : "hover:bg-[#2d2d2d] border border-transparent"
                    )}
                    onClick={() => onSelectAIModel(model.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(model.id);
                      }}
                      className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      )}
                    </button>

                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#8B5CF6]/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {model.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#6b6b6b]">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-[#8B5CF6]/30 text-[#8B5CF6]"
                        >
                          {model.modelType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-[#6b6b6b]/30 text-[#6b6b6b]"
                        >
                          {model.modelSource}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <EntityActions onDelete={() => onDeleteAIModel(model.id)} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                      <div className="space-y-2 py-1">
                        {model.description && (
                          <p className="text-[11px] text-[#6b6b6b] px-2">
                            {model.description}
                          </p>
                        )}
                        {model.metrics?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-medium text-[#6b6b6b] px-2">
                              评估指标
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1 px-2">
                              {model.metrics.map((m: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-[#8B5CF6]/30 text-[#8B5CF6]"
                                >
                                  {m.metricName}: {m.metricValue.toFixed(2)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analysis Insights Section */}
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-xs font-semibold text-[#a0a0a0]">分析洞察</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-[#2d2d2d] text-[#6b6b6b] ml-auto"
          >
            {analysisInsights.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6b6b6b] hover:text-white"
            onClick={onOpenCreateAnalysisInsightDialog}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {analysisInsights.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            message="暂无分析洞察"
            description="创建数据分析和报表"
          />
        ) : (
          <div className="space-y-1">
            {analysisInsights.map((insight) => {
              const isSelected = selectedAnalysisInsightId === insight.id;
              const isExpanded = expandedIds.has(insight.id);

              return (
                <div key={insight.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                      isSelected
                        ? "bg-[#F59E0B]/10 border border-[#F59E0B]/30"
                        : "hover:bg-[#2d2d2d] border border-transparent"
                    )}
                    onClick={() => onSelectAnalysisInsight(insight.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(insight.id);
                      }}
                      className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                      )}
                    </button>

                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#06B6D4]/10 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-[#06B6D4]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {insight.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#6b6b6b]">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-[#06B6D4]/30 text-[#06B6D4]"
                        >
                          {insight.insightType}
                        </Badge>
                        {insight.refreshFrequency && (
                          <span>{insight.refreshFrequency}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <EntityActions
                        onDelete={() => onDeleteAnalysisInsight(insight.id)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                      <div className="space-y-2 py-1">
                        {insight.description && (
                          <p className="text-[11px] text-[#6b6b6b] px-2">
                            {insight.description}
                          </p>
                        )}
                        {insight.dataSources?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-medium text-[#6b6b6b] px-2">
                              数据源
                            </span>
                            <div className="space-y-1 mt-1 px-2">
                              {insight.dataSources.map(
                                (ds: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-[11px]"
                                  >
                                    <Database className="w-3 h-3 text-[#6b6b6b]" />
                                    <span className="text-white">
                                      {ds.objectTypeId}
                                    </span>
                                    {ds.aggregation && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0"
                                      >
                                        {ds.aggregation}
                                      </Badge>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {insight.visualization && (
                          <div className="px-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-[#06B6D4]/30 text-[#06B6D4]"
                            >
                              {insight.visualization.chartType} 图表
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Helper Components ====================
function EmptyState({
  icon: Icon,
  message,
  description,
}: {
  icon: LucideIcon;
  message: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-[#2d2d2d] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#6b6b6b]" />
      </div>
      <p className="text-xs text-[#6b6b6b]">{message}</p>
      <p className="text-[10px] text-[#4a4a4a] mt-1">{description}</p>
    </div>
  );
}

function EntityActions({
  onDelete,
}: {
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem>编辑</DropdownMenuItem>
        <DropdownMenuItem>复制</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400" onClick={onDelete}>
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
