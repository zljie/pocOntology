"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  ShoppingCart,
  Package,
  MapPin,
  Building,
  CreditCard,
  Truck,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { ObjectType } from "@/lib/types/ontology";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  User,
  ShoppingCart,
  Package,
  MapPin,
  Building,
  CreditCard,
  Truck,
  FileText,
};

interface ObjectTypeNodeData {
  objectType: ObjectType;
  selected?: boolean;
  highlighted?: boolean;
}

function ObjectTypeNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ObjectTypeNodeData;
  const { objectType, highlighted } = nodeData;
  const Icon = iconMap[objectType.icon || ""] || FileText;

  return (
    <div
      className={cn(
        "transition-all duration-200",
        selected && "scale-105",
        highlighted && !selected && "scale-[1.02]"
      )}
    >
      <Card
        className={cn(
          "w-[200px] bg-[#1a1a18] border transition-colors",
          selected
            ? "border-[#5b8def] shadow-lg shadow-[#5b8def]/20"
            : highlighted
            ? "border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20"
            : "border-[#2d2d2d] hover:border-[#3d3d3d]"
        )}
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                selected
                  ? "bg-[#5b8def]/20"
                  : highlighted
                  ? "bg-[#8B5CF6]/20"
                  : "bg-[#2d2d2d]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  selected ? "text-[#5b8def]" : highlighted ? "text-[#8B5CF6]" : "text-[#6b6b6b]"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium text-white truncate">
                {objectType.displayName}
              </CardTitle>
              <span className="text-[10px] text-[#6b6b6b] font-mono">
                {objectType.apiName}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 pt-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                objectType.visibility === "GLOBAL"
                  ? "border-green-500/30 text-green-400"
                  : objectType.visibility === "PROJECT"
                  ? "border-yellow-500/30 text-yellow-400"
                  : "border-red-500/30 text-red-400"
              )}
            >
              {objectType.visibility}
            </Badge>
            <span className="text-[10px] text-[#6b6b6b]">
              {objectType.properties.length} 属性
            </span>
          </div>

          {/* Property Preview */}
          <div className="space-y-1">
            {objectType.properties.slice(0, 3).map((prop) => (
              <div
                key={prop.id}
                className="flex items-center gap-1.5 text-[10px]"
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    prop.baseType === "STRING"
                      ? "bg-blue-400"
                      : prop.baseType === "INTEGER" || prop.baseType === "DOUBLE"
                      ? "bg-green-400"
                      : prop.baseType === "TIMESTAMP"
                      ? "bg-yellow-400"
                      : prop.baseType === "BOOLEAN"
                      ? "bg-orange-400"
                      : "bg-cyan-400"
                  )}
                />
                <span className="text-[#a0a0a0] truncate">
                  {prop.displayName}
                </span>
                {objectType.primaryKey === prop.id && (
                  <span className="text-[#5b8def] font-mono">PK</span>
                )}
              </div>
            ))}
            {objectType.properties.length > 3 && (
              <span className="text-[10px] text-[#6b6b6b]">
                +{objectType.properties.length - 3} 更多
              </span>
            )}
          </div>
        </CardContent>

        {/* Connection Handles */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-[#5b8def] !border-2 !border-[#1a1a18]"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-[#5b8def] !border-2 !border-[#1a1a18]"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-2 !h-2 !bg-[#3d3d3d] !border-2 !border-[#1a1a18] opacity-0 hover:opacity-100"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-2 !h-2 !bg-[#3d3d3d] !border-2 !border-[#1a1a18] opacity-0 hover:opacity-100"
        />
      </Card>
    </div>
  );
}

export const ObjectTypeNode = memo(ObjectTypeNodeComponent);
