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
import { useOntologyStore } from "@/stores";
import { useUIStore } from "@/stores";
import { SemanticQueryInput } from "@/components/semantic-query/semantic-query-input";
import { BusinessScenarioSandbox } from "@/components/scenario-sandbox/business-scenario-sandbox";

export function Header() {
  const { objectTypes, linkTypes, loadSampleData, clearAll } = useOntologyStore();
  const { setShowImportDialog, showProposalBanner } = useUIStore();
  const [showSemanticQuery, setShowSemanticQuery] = useState(false);
  const [showScenarioSandbox, setShowScenarioSandbox] = useState(false);
  const pendingCount = objectTypes.length;

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
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
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
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>导出模型</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-[#3d3d3d] mx-1" />

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
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]"
                onClick={() => clearAll()}
              >
                清空
              </Button>
            </TooltipTrigger>
            <TooltipContent>清空所有数据</TooltipContent>
          </Tooltip>

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
    </header>
  );
}
