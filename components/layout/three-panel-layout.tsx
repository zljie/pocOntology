"use client";

import React, { useCallback, useState } from "react";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/utils";
import { SemanticQueryPreviewPanel } from "@/components/semantic-query/semantic-query-preview-panel";

interface ThreePanelLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  showBottomPreview?: boolean;
}

export function ThreePanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  showBottomPreview = true,
}: ThreePanelLayoutProps) {
  const {
    leftPanelOpen,
    rightPanelOpen,
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    setRightPanelWidth,
    toggleLeftPanel,
  } = useUIStore();

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleMouseDownLeft = useCallback(() => {
    setIsResizingLeft(true);
  }, []);

  const handleMouseDownRight = useCallback(() => {
    setIsResizingRight(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(280, Math.min(500, e.clientX));
        setLeftPanelWidth(newWidth);
      }
      if (isResizingRight) {
        const viewportWidth = window.innerWidth;
        const newWidth = Math.max(320, Math.min(900, viewportWidth - e.clientX));
        setRightPanelWidth(newWidth);
      }
    },
    [isResizingLeft, isResizingRight, setLeftPanelWidth, setRightPanelWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  }, []);

  React.useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-[#161614] overflow-hidden",
          leftPanelOpen ? "transition-[width] duration-300" : "transition-[width] duration-300"
        )}
        style={{ width: leftPanelOpen ? leftPanelWidth : 0 }}
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
        {showBottomPreview && <SemanticQueryPreviewPanel />}
      </div>

      {/* Right Resize Handle & Panel */}
      {rightPanelOpen && (
        <>
          <div
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[#5b8def]/50 transition-colors group"
            onMouseDown={handleMouseDownRight}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 rounded-full bg-[#3d3d3d] group-hover:bg-[#5b8def] transition-colors" />
            </div>
          </div>
          <div
            className={cn("flex-shrink-0 bg-[#161614] border-l overflow-hidden", isResizingRight ? "" : "transition-[width] duration-300")}
            style={{ width: rightPanelWidth }}
          >
            {rightPanel}
          </div>
        </>
      )}
    </div>
  );
}
