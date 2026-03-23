"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOntologyStore } from "@/stores";
import { useSelectionStore } from "@/stores";
import { useUIStore } from "@/stores";
import { ObjectType } from "@/lib/types/ontology";
import { cn } from "@/lib/utils";
import { CreateObjectTypeDialog } from "./create-object-type-dialog";
import { PropertyTypeIcon } from "./property-type-icon";

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

interface ObjectTypeListProps {
  onSelect?: (objectType: ObjectType) => void;
}

export function ObjectTypeList({ onSelect }: ObjectTypeListProps) {
  const { objectTypes, deleteObjectType } = useOntologyStore();
  const { selectedObjectTypeId, selectObjectType } = useSelectionStore();
  const { openRightPanel } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const filteredObjectTypes = objectTypes.filter(
    (ot) =>
      ot.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ot.apiName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleSelect = (objectType: ObjectType) => {
    selectObjectType(objectType.id);
    openRightPanel();
    onSelect?.(objectType);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteObjectType(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#2d2d2d]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">对象类型</h2>
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs bg-[#5b8def] hover:bg-[#4a7ce0]"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            新建
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b6b]" />
          <Input
            placeholder="搜索对象类型..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-[#0d0d0d] border-[#2d2d2d] focus:border-[#5b8def]"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredObjectTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-[#6b6b6b]" />
              </div>
              <p className="text-sm text-[#6b6b6b]">暂无对象类型</p>
              <p className="text-xs text-[#4a4a4a] mt-1">
                点击上方"新建"创建第一个对象类型
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredObjectTypes.map((objectType) => {
                const Icon = iconMap[objectType.icon || ""] || FileText;
                const isSelected = selectedObjectTypeId === objectType.id;
                const isExpanded = expandedIds.has(objectType.id);

                return (
                  <div key={objectType.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group",
                        isSelected
                          ? "bg-[#5b8def]/10 border border-[#5b8def]/30"
                          : "hover:bg-[#2d2d2d] border border-transparent"
                      )}
                      onClick={() => handleSelect(objectType)}
                    >
                      {/* Expand Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(objectType.id);
                        }}
                        className="flex-shrink-0 p-0.5 hover:bg-[#3d3d3d] rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#6b6b6b]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#6b6b6b]" />
                        )}
                      </button>

                      {/* Icon */}
                      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#2d2d2d] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[#5b8def]" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {objectType.displayName}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-mono",
                              objectType.visibility === "GLOBAL"
                                ? "border-green-500/30 text-green-400"
                                : objectType.visibility === "PROJECT"
                                ? "border-yellow-500/30 text-yellow-400"
                                : "border-red-500/30 text-red-400"
                            )}
                          >
                            {objectType.visibility}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-[#6b6b6b] font-mono">
                          {objectType.apiName}
                        </span>
                      </div>

                      {/* Property Count */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="text-[11px] text-[#6b6b6b]">
                          {objectType.properties.length} 属性
                        </span>

                        {/* Actions */}
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
                            <DropdownMenuItem>复制 API 名称</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={(e) => handleDelete(e, objectType.id)}
                            >
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Expanded Properties */}
                    {isExpanded && (
                      <div className="ml-6 pl-4 border-l border-[#2d2d2d] mt-1 mb-2">
                        <div className="space-y-1 py-1">
                          {objectType.properties.map((prop) => (
                            <div
                              key={prop.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2d2d2d]"
                            >
                              <PropertyTypeIcon type={prop.baseType} />
                              <span className="text-xs text-white">
                                {prop.displayName}
                              </span>
                              <span className="text-[10px] text-[#6b6b6b] font-mono ml-auto">
                                {prop.apiName}
                              </span>
                              {objectType.primaryKey === prop.id && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 border-[#5b8def]/30 text-[#5b8def]"
                                >
                                  PK
                                </Badge>
                              )}
                              {objectType.titleKey === prop.id && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 border-[#5b8def]/30 text-[#5b8def]"
                                >
                                  标题
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Dialog */}
      <CreateObjectTypeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
