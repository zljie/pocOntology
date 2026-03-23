"use client";

import React, { useState, useCallback } from "react";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/utils";
import { SemanticQueryPreviewPanel } from "@/components/semantic-query/semantic-query-preview-panel";

interface ThreePanelLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function ThreePanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
}: ThreePanelLayoutProps) {
  const {
    leftPanelOpen,
    rightPanelOpen,
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    toggleLeftPanel,
  } = useUIStore();

  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const handleMouseDownLeft = useCallback(() => {
    setIsResizingLeft(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(280, Math.min(500, e.clientX));
        setLeftPanelWidth(newWidth);
      }
    },
    [isResizingLeft, setLeftPanelWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
  }, []);

  React.useEffect(() => {
    if (isResizingLeft) {
      document.addEventListener("mousemove", handleMouseMove as unknown as EventListener);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove as unknown as EventListener);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-[#161614] transition-all duration-300 overflow-hidden",
          leftPanelOpen ? "w-[340px]" : "w-0"
        )}
      >
        {leftPanel}
      </div>

      {/* Left Resize Handle */}
      {leftPanelOpen && (
        <div
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[#5b8def]/50 transition-colors group"
          onMouseDown={handleMouseDownLeft}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 rounded-full bg-[#3d3d3d] group-hover:bg-[#5b8def] transition-colors" />
          </div>
        </div>
      )}

      {/* Center Panel (Canvas) */}
      <div className="flex-1 bg-[#0d0d0d] overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0">
          {centerPanel}
        </div>
        <SemanticQueryPreviewPanel />
      </div>

      {/* Right Resize Handle & Panel */}
      {rightPanelOpen && (
        <>
          <div className="w-1 flex-shrink-0 bg-[#2d2d2d]" />
          <div className="w-[400px] flex-shrink-0 bg-[#161614] border-l overflow-hidden">
            {rightPanel}
          </div>
        </>
      )}
    </div>
  );
}
