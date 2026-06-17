"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useConsultingStore, useOntologyStore, useSelectionStore, useUIStore } from "@/stores";

const SCALE_LABEL: Record<"S" | "M" | "L" | "XL", string> = {
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
};

export function BusinessDomainPlannerPanel() {
  const { objectTypes } = useOntologyStore();
  const {
    domains,
    selectedDomainId,
    selectDomain,
    addDomain,
    updateDomain,
    removeDomain,
    toggleEntityInDomain,
    setEntityScale,
  } = useConsultingStore();
  const { setSemanticHighlightedNodeIds, clearSemanticHighlightedNodeIds, selectObjectType } = useSelectionStore();
  const { openRightPanel } = useUIStore();

  const selectedDomain = React.useMemo(
    () => domains.find((d) => d.id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  React.useEffect(() => {
    if (!selectedDomain) {
      clearSemanticHighlightedNodeIds();
      return;
    }
    setSemanticHighlightedNodeIds(selectedDomain.objectTypeIds);
  }, [selectedDomainId, selectedDomain, setSemanticHighlightedNodeIds, clearSemanticHighlightedNodeIds]);

  const [search, setSearch] = React.useState("");
  const filteredObjectTypes = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return objectTypes;
    return objectTypes.filter((ot) => (ot.displayName || "").toLowerCase().includes(q) || (ot.apiName || "").toLowerCase().includes(q));
  }, [objectTypes, search]);

  return (
    <div className="h-full flex flex-col bg-[#161614] text-[#e0e0e0]">
      <div className="flex-none p-4 border-b border-[#2d2d2d]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">业务域规划</h2>
            <p className="text-[11px] text-[#808080] mt-1">在梳理业务时，先划分业务域，再为实体类型标注规模</p>
          </div>
          <Button
            size="sm"
            className="h-8 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white"
            onClick={() => {
              addDomain(`业务域 ${domains.length + 1}`);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            新建
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          <div className="space-y-2">
            {domains.length === 0 && (
              <div className="text-xs text-[#6b6b6b] p-3 border border-[#2d2d2d] rounded-md bg-[#0d0d0d]">
                先创建业务域，然后把左侧的实体类型分配进去并标注规模等级。
              </div>
            )}
            {domains.map((d) => {
              const isActive = d.id === selectedDomainId;
              return (
                <button
                  key={d.id}
                  className={`w-full text-left p-3 rounded-md border ${
                    isActive ? "bg-[#5b8def]/10 border-[#5b8def]/30" : "bg-[#0d0d0d] border-[#2d2d2d] hover:border-[#3d3d3d]"
                  }`}
                  onClick={() => {
                    selectDomain(d.id);
                    openRightPanel();
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{d.name || "未命名业务域"}</div>
                      <div className="text-[11px] text-[#808080] truncate">{d.description || "未填写说明"}</div>
                    </div>
                    <Badge className="text-[10px] bg-[#2d2d2d] border-0 text-[#d0d0d0]">{d.objectTypeIds.length}</Badge>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDomain && (
            <div className="border border-[#2d2d2d] rounded-md bg-[#0d0d0d] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[#a0a0a0]">业务域详情</div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[#fca5a5] hover:text-[#fecaca] hover:bg-red-500/10"
                  onClick={() => {
                    removeDomain(selectedDomain.id);
                    clearSemanticHighlightedNodeIds();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-[#a0a0a0]">业务域名称</Label>
                <Input
                  value={selectedDomain.name}
                  onChange={(e) => updateDomain(selectedDomain.id, { name: e.target.value })}
                  className="h-9 bg-[#141414] border-[#2d2d2d] focus:border-[#5b8def] text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-[#a0a0a0]">业务域说明</Label>
                <Textarea
                  value={selectedDomain.description}
                  onChange={(e) => updateDomain(selectedDomain.id, { description: e.target.value })}
                  className="min-h-[72px] bg-[#141414] border-[#2d2d2d] focus:border-[#5b8def] text-sm"
                  placeholder="描述该业务域的范围、边界与关键流程…"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px] text-[#a0a0a0]">实体类型分配</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索实体…"
                      className="h-8 w-[170px] bg-[#141414] border-[#2d2d2d] focus:border-[#5b8def] text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  {filteredObjectTypes.map((ot) => {
                    const checked = selectedDomain.objectTypeIds.includes(ot.id);
                    const scale = selectedDomain.entityScales[ot.id] || "M";
                    return (
                      <div
                        key={ot.id}
                        className={`flex items-center gap-2 p-2 rounded-md border ${
                          checked ? "border-[#5b8def]/30 bg-[#5b8def]/5" : "border-[#2d2d2d] bg-[#141414]"
                        }`}
                      >
                        <button
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            checked ? "bg-[#5b8def] border-[#5b8def]" : "bg-transparent border-[#3d3d3d]"
                          }`}
                          onClick={() => toggleEntityInDomain(selectedDomain.id, ot.id)}
                        >
                          {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </button>
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => {
                            selectObjectType(ot.id);
                            openRightPanel();
                          }}
                        >
                          <div className="text-[12px] text-white truncate">{ot.displayName}</div>
                          <div className="text-[10px] text-[#6b6b6b] truncate">{ot.apiName}</div>
                        </button>
                        {checked && (
                          <Select value={scale} onValueChange={(v) => setEntityScale(selectedDomain.id, ot.id, v as any)}>
                            <SelectTrigger className="h-8 w-[78px] bg-[#0d0d0d] border-[#2d2d2d] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#161614] border-[#2d2d2d]">
                              {(["S", "M", "L", "XL"] as const).map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {SCALE_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
