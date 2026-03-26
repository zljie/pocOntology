"use client";

import React from "react";
import {
  Grid3X3,
  Map,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/utils";

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function ToolButton({ icon: Icon, label, active, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            active
              ? "bg-[#5b8def]/20 text-[#5b8def] hover:bg-[#5b8def]/30"
              : "text-[#a0a0a0] hover:bg-[#2d2d2d] hover:text-white"
          )}
          onClick={onClick}
        >
          <Icon className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-[#1a1a18] border-[#2d2d2d]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function CanvasToolbar() {
  const { showGrid, showMinimap, canvasViewMode, toggleGrid, toggleMinimap, toggleCanvasViewMode } = useUIStore();

  return (
    <div className="bg-[#1a1a18] border border-[#2d2d2d] rounded-lg p-1 flex items-center gap-0.5">
      <ToolButton
        icon={Grid3X3}
        label={showGrid ? "隐藏网格" : "显示网格"}
        active={showGrid}
        onClick={toggleGrid}
      />
      <ToolButton
        icon={Map}
        label={showMinimap ? "隐藏小地图" : "显示小地图"}
        active={showMinimap}
        onClick={toggleMinimap}
      />
      
      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />
      
      <ToolButton icon={ZoomIn} label="放大" />
      <ToolButton icon={ZoomOut} label="缩小" />
      <ToolButton icon={Maximize2} label="适应屏幕" />
      
      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />
      
      <ToolButton icon={LayoutGrid} label="自动布局" />

      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />

      <ToolButton
        icon={Share2}
        label={canvasViewMode === "EDITOR" ? "切换到图谱模式" : "切换到编辑模式"}
        active={canvasViewMode === "KNOWLEDGE_GRAPH"}
        onClick={toggleCanvasViewMode}
      />
    </div>
  );
}
