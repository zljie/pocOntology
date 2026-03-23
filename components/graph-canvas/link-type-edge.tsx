"use client";

import React, { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { Cardinality } from "@/lib/types/ontology";
import { cn } from "@/lib/utils";

interface LinkTypeEdgeData {
  linkType: {
    id: string;
    displayName: string;
    cardinality: Cardinality;
  };
  cardinality: Cardinality;
  label: string;
}

function LinkTypeEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as LinkTypeEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getCardinalitySymbol = (cardinality: Cardinality) => {
    switch (cardinality) {
      case "ONE_TO_ONE":
        return "1:1";
      case "ONE_TO_MANY":
        return "1:N";
      case "MANY_TO_ONE":
        return "N:1";
      case "MANY_TO_MANY":
        return "M:N";
      default:
        return "";
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          "!stroke-[2px]",
          selected
            ? "!stroke-[#5b8def] !stroke-opacity-100"
            : "!stroke-[#3d3d3d] !stroke-opacity-60"
        )}
        style={{
          strokeDasharray: edgeData?.cardinality === "MANY_TO_MANY" ? "5,5" : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div
            className={cn(
              "px-2 py-1 rounded text-[10px] font-mono transition-colors",
              selected
                ? "bg-[#5b8def]/20 text-[#5b8def] border border-[#5b8def]/30"
                : "bg-[#1a1a18] text-[#6b6b6b] border border-[#2d2d2d]"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{edgeData?.label || "Link"}</span>
              <span className="text-[#5b8def]">
                {getCardinalitySymbol(edgeData?.cardinality || "ONE_TO_MANY")}
              </span>
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const LinkTypeEdge = memo(LinkTypeEdgeComponent);
