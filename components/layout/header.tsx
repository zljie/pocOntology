"use client";

import React, { useState } from "react";
import {
  Database,
  GitBranch,
  Download,
  Upload,
  Settings,
  HelpCircle,
  Layers,
  Sparkles,
  X,
  Boxes,
  FilePlus,
  Users,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOntologyStore, useSelectionStore, useProposalStore } from "@/stores";
import { useUIStore } from "@/stores";
import { SemanticQueryInput } from "@/components/semantic-query/semantic-query-input";
import { BusinessScenarioSandbox } from "@/components/scenario-sandbox/business-scenario-sandbox";
import { OrmTestPanel } from "@/components/orm-test/orm-test-panel";
import { MetaToolboxSheet } from "@/components/meta/meta-toolbox-sheet";
import { createNeo4jDatabaseClient, upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { MetaCore } from "@/lib/meta/meta-core";

function isValidNeo4jDbName(name: string) {
  return /^[a-z][a-z0-9.-]{0,62}$/.test(name);
}

export function Header() {
  const {
    objectTypes,
    linkTypes,
    actionTypes,
    dataFlows,
    businessRules,
    aiModels,
    analysisInsights,
    scenario,
    loadSampleData,
    clearAll: clearOntology,
    neo4jProject,
    setNeo4jProject,
  } = useOntologyStore();
  const { clearAll: clearSelection } = useSelectionStore();
  const { clearAll: clearProposals } = useProposalStore();
  const { setShowImportDialog, showProposalBanner, workMode, setWorkMode, setCanvasViewMode, openRightPanel } = useUIStore();
  const [showSemanticQuery, setShowSemanticQuery] = useState(false);
  const [showScenarioSandbox, setShowScenarioSandbox] = useState(false);
  const [showOrmTest, setShowOrmTest] = useState(false);
  const [showMetaToolbox, setShowMetaToolbox] = useState(false);
  const [showNewCanvasDialog, setShowNewCanvasDialog] = useState(false);
  const [newProjectDbName, setNewProjectDbName] = useState("");
  const [newProjectDisplayName, setNewProjectDisplayName] = useState("");
  const [newCanvasError, setNewCanvasError] = useState<string | null>(null);
  const [isCreatingCanvas, setIsCreatingCanvas] = useState(false);
  const [neo4jSaveError, setNeo4jSaveError] = useState<string | null>(null);
  const [neo4jSaveSuccess, setNeo4jSaveSuccess] = useState<string | null>(null);
  const [isSavingNeo4j, setIsSavingNeo4j] = useState(false);
  const pendingCount = objectTypes.length;

  const handleOpenNewCanvas = () => {
    setNewCanvasError(null);
    setNewProjectDbName("");
    setNewProjectDisplayName("");
    setShowNewCanvasDialog(true);
  };

  const handleCreateCanvas = async () => {
    const dbName = newProjectDbName.trim();
    const displayName = newProjectDisplayName.trim();

    if (!dbName) {
      setNewCanvasError("项目名称不能为空");
      return;
    }
    if (!isValidNeo4jDbName(dbName)) {
      setNewCanvasError("项目名称不符合 Neo4j db 命名要求（小写字母开头，仅小写字母/数字/点/短横线）");
      return;
    }
    if (!displayName) {
      setNewCanvasError("显示名称不能为空");
      return;
    }

    setIsCreatingCanvas(true);
    setNewCanvasError(null);
    try {
      await createNeo4jDatabaseClient(dbName);

      clearOntology();
      clearSelection();
      clearProposals();
      setNeo4jProject({ dbName, displayName });
      setShowNewCanvasDialog(false);
    } catch (e: any) {
      setNewCanvasError(e?.message || "创建 Neo4j 数据库失败");
    } finally {
      setIsCreatingCanvas(false);
    }
  };

  const handleSaveNeo4j = async () => {
    if (!neo4jProject) {
      setNeo4jSaveSuccess(null);
      setNeo4jSaveError("请先新建本体画布（Neo4j 项目）");
      return;
    }

    setIsSavingNeo4j(true);
    setNeo4jSaveError(null);
    setNeo4jSaveSuccess(null);
    try {
      const meta: MetaCore = {
        scenario,
        objectTypes,
        linkTypes,
        actionTypes,
        dataFlows,
        businessRules,
        aiModels,
        analysisInsights,
      };
      await upsertMetaToNeo4jClient({
        database: neo4jProject.dbName,
        scenario: neo4jProject.dbName,
        meta,
      });
      setNeo4jSaveSuccess("已保存到 Neo4j");
    } catch (e: any) {
      setNeo4jSaveError(e?.message || "保存到 Neo4j 失败");
    } finally {
      setIsSavingNeo4j(false);
    }
  };

  return (
    <header className="h-14 border-b bg-[#161614] flex items-center justify-between px-4">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5b8def] to-[#3d6bc7] flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Ontology Design Simulator
              </h1>
              <p className="text-[10px] text-[#6b6b6b] font-mono">
                Palantir-style Digital Twin Modeling
              </p>
            </div>
          </div>
          
          <div className="ml-4 flex items-center gap-2">
            <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
              <Database className="w-3 h-3 mr-1" />
              {objectTypes.length} 对象类型
            </Badge>
            <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
              <GitBranch className="w-3 h-3 mr-1" />
              {linkTypes.length} 链接类型
            </Badge>
            {neo4jProject && (
              <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
                <Database className="w-3 h-3 mr-1" />
                {neo4jProject.displayName}（{neo4jProject.dbName}）
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Status */}
        <div className="flex items-center gap-4">
          {showProposalBanner && pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#5b8def]/10 border border-[#5b8def]/20">
              <div className="w-2 h-2 rounded-full bg-[#5b8def] animate-pulse" />
              <span className="text-xs text-[#5b8def]">草稿已保存</span>
            </div>
          )}
          {neo4jSaveSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#10B981]/10 border border-[#10B981]/20">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-xs text-[#10B981]">{neo4jSaveSuccess}</span>
            </div>
          )}
          {neo4jSaveError && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-red-400">{neo4jSaveError}</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-[#3d3d3d] overflow-hidden mr-1">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-none text-xs ${
                workMode === "ONTOLOGY_DESIGN"
                  ? "bg-[#2d2d2d] text-white"
                  : "text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
              }`}
              onClick={() => setWorkMode("ONTOLOGY_DESIGN")}
            >
              <PenTool className="w-3.5 h-3.5 mr-1" />
              本体设计模式
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-none text-xs ${
                workMode === "CONSULTING"
                  ? "bg-[#2d2d2d] text-white"
                  : "text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
              }`}
              onClick={() => {
                setWorkMode("CONSULTING");
                setCanvasViewMode("KNOWLEDGE_GRAPH");
                openRightPanel();
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              咨询模式
            </Button>
          </div>

          <Button
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 text-white"
            onClick={() => setShowOrmTest(true)}
          >
            <Database className="w-4 h-4 mr-1" />
            ORM 测试
          </Button>

          <Button
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:opacity-90 text-white"
            onClick={() => setShowScenarioSandbox(true)}
          >
            <Boxes className="w-4 h-4 mr-1" />
            业务场景沙盘
          </Button>

          {/* Semantic Query Button */}
          <Button
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] hover:opacity-90 text-white"
            onClick={() => setShowSemanticQuery(true)}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            语义查询
          </Button>

          <div className="w-px h-6 bg-[#3d3d3d] mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>导入模型</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={() => setShowMetaToolbox(true)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>导出模型</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs bg-transparent border-[#3d3d3d] text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={handleSaveNeo4j}
                disabled={isSavingNeo4j}
              >
                <Database className="w-4 h-4" />
                <span className="ml-1">{isSavingNeo4j ? "保存中…" : "保存Neo4j"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>保存到 Neo4j</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-[#3d3d3d] mx-1" />

          <Button
            variant="default"
            size="sm"
            className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white"
            onClick={handleOpenNewCanvas}
          >
            <FilePlus className="w-4 h-4 mr-1" />
            新建本体
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
              >
                加载示例
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-[#161614] border-[#3d3d3d] text-[#a0a0a0]">
              <DropdownMenuItem 
                onClick={() => loadSampleData('library')}
                className="hover:bg-[#2d2d2d] hover:text-white focus:bg-[#2d2d2d] focus:text-white cursor-pointer"
              >
                <Layers className="w-4 h-4 mr-2" />
                图书馆管理系统
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => loadSampleData('erp')}
                className="hover:bg-[#2d2d2d] hover:text-white focus:bg-[#2d2d2d] focus:text-white cursor-pointer"
              >
                <Boxes className="w-4 h-4 mr-2" />
                ERP采购业务模块
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => loadSampleData('sap_hcm')}
                className="hover:bg-[#2d2d2d] hover:text-white focus:bg-[#2d2d2d] focus:text-white cursor-pointer"
              >
                <Users className="w-4 h-4 mr-2" />
                SAP HCM 模块
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-[#3d3d3d] mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>帮助</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>设置</TooltipContent>
          </Tooltip>
        </div>

      {/* Semantic Query Sheet */}
      <Sheet open={showSemanticQuery} onOpenChange={setShowSemanticQuery} showOverlay={false}>
        <SheetContent 
          className="w-[500px] sm:w-[540px] bg-[#0d0d0d] border-[#2d2d2d] p-0"
          onOpenChange={setShowSemanticQuery}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>语义查询</SheetTitle>
          </SheetHeader>
          <SemanticQueryInput />
        </SheetContent>
      </Sheet>

      <Sheet open={showScenarioSandbox} onOpenChange={setShowScenarioSandbox} showOverlay={false}>
        <SheetContent
          className="w-[720px] sm:w-[780px] bg-[#0d0d0d] border-[#2d2d2d] p-0"
          onOpenChange={setShowScenarioSandbox}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>业务场景沙盘</SheetTitle>
          </SheetHeader>
          <BusinessScenarioSandbox />
        </SheetContent>
      </Sheet>

      <Sheet open={showOrmTest} onOpenChange={setShowOrmTest} showOverlay={false}>
        <SheetContent
          className="w-[500px] sm:w-[540px] bg-[#0d0d0d] border-[#2d2d2d] p-0"
          onOpenChange={setShowOrmTest}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>ORM 测试助手</SheetTitle>
          </SheetHeader>
          <OrmTestPanel />
        </SheetContent>
      </Sheet>

      <MetaToolboxSheet open={showMetaToolbox} onOpenChange={setShowMetaToolbox} />

      <Dialog open={showNewCanvasDialog} onOpenChange={setShowNewCanvasDialog}>
        <DialogContent className="sm:max-w-[425px] bg-[#161614] border-[#3d3d3d] text-white">
          <DialogHeader>
            <DialogTitle>新建本体画布（Neo4j 项目）</DialogTitle>
            <DialogDescription className="text-[#a0a0a0]">
              创建后将清空当前画布，并在 Neo4j 中创建同名数据库；后续新增实体类会写入对应数据库。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-[#d0d0d0]">项目名称（Neo4j dbName）</Label>
              <Input
                value={newProjectDbName}
                onChange={(e) => setNewProjectDbName(e.target.value)}
                placeholder="例如：erp_purchase"
                className="bg-[#0d0d0d] border-[#3d3d3d] text-white placeholder:text-[#6b6b6b]"
              />
              <div className="text-[11px] text-[#6b6b6b]">
                规则：小写字母开头，仅允许小写字母/数字/点/短横线
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#d0d0d0]">显示名称</Label>
              <Input
                value={newProjectDisplayName}
                onChange={(e) => setNewProjectDisplayName(e.target.value)}
                placeholder="例如：ERP 采购推演项目"
                className="bg-[#0d0d0d] border-[#3d3d3d] text-white placeholder:text-[#6b6b6b]"
              />
            </div>
            {newCanvasError && <div className="text-sm text-red-400">{newCanvasError}</div>}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowNewCanvasDialog(false)}
              className="bg-transparent border-[#3d3d3d] text-white hover:bg-[#2d2d2d]"
              disabled={isCreatingCanvas}
            >
              取消
            </Button>
            <Button
              variant="default"
              onClick={handleCreateCanvas}
              className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white"
              disabled={isCreatingCanvas}
            >
              {isCreatingCanvas ? "创建中…" : "创建并切换"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
