"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ChangeConfirmTone = "neutral" | "create" | "update" | "warn";

export interface ChangeConfirmItem {
  id: string;
  title: string;
  description?: string;
  tone?: ChangeConfirmTone;
  defaultSelected?: boolean;
  disabled?: boolean;
}

export interface ChangeConfirmSection {
  key: string;
  title: string;
  description?: string;
  items: ChangeConfirmItem[];
}

function toneBadge(tone: ChangeConfirmTone | undefined) {
  if (tone === "create") return { text: "新增", className: "bg-emerald-500/15 text-emerald-200" };
  if (tone === "update") return { text: "调整", className: "bg-sky-500/15 text-sky-200" };
  if (tone === "warn") return { text: "需确认", className: "bg-amber-500/15 text-amber-200" };
  return null;
}

export function ChangeConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  sections: ChangeConfirmSection[];
  confirmText?: string;
  cancelText?: string;
  onConfirm: (selectedItemIds: string[]) => Promise<void> | void;
}) {
  const { open, onOpenChange, title, description, sections, confirmText, cancelText, onConfirm } = props;
  const allItems = React.useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const selectableIds = React.useMemo(() => allItems.filter((i) => !i.disabled).map((i) => i.id), [allItems]);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const next = new Set<string>();
    for (const item of allItems) {
      if (item.disabled) continue;
      if (item.defaultSelected !== false) next.add(item.id);
    }
    setSelected(next);
  }, [open, allItems]);

  const selectedCount = selected.size;
  const totalCount = selectableIds.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAll = (value: boolean) => {
    setSelected(() => {
      if (!value) return new Set();
      return new Set(selectableIds);
    });
  };

  const handleConfirm = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      await onConfirm(Array.from(selected));
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription className="text-[#a0a0a0]">{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#a0a0a0]">
            已选 <span className="text-white">{selectedCount}</span> / {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 border-[#2d2d2d] text-[#d0d0d0]"
              onClick={() => setAll(true)}
              disabled={isApplying || totalCount === 0}
            >
              全选
            </Button>
            <Button
              variant="outline"
              className="h-8 px-3 border-[#2d2d2d] text-[#d0d0d0]"
              onClick={() => setAll(false)}
              disabled={isApplying || totalCount === 0}
            >
              全不选
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-3">
            {sections.map((section) => {
              const items = section.items;
              if (!items.length) return null;
              return (
                <div key={section.key} className="border border-[#2d2d2d] rounded-md bg-[#0d0d0d]">
                  <div className="p-3 border-b border-[#2d2d2d]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-white">{section.title}</div>
                        {section.description && <div className="text-[11px] text-[#808080] mt-1">{section.description}</div>}
                      </div>
                      <Badge className="text-[10px] bg-[#2d2d2d] border-0 text-[#d0d0d0]">{items.length}</Badge>
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    {items.map((item) => {
                      const checked = selected.has(item.id);
                      const badge = toneBadge(item.tone);
                      return (
                        <button
                          key={item.id}
                          className={`w-full text-left flex items-start gap-2 p-2 rounded-md border ${
                            item.disabled
                              ? "border-[#2d2d2d] bg-[#141414]/40 opacity-70 cursor-not-allowed"
                              : checked
                                ? "border-[#5b8def]/30 bg-[#5b8def]/5"
                                : "border-[#2d2d2d] bg-[#141414] hover:border-[#3d3d3d]"
                          }`}
                          onClick={() => {
                            if (item.disabled) return;
                            toggle(item.id);
                          }}
                          type="button"
                        >
                          <div className="mt-[2px] flex-none">
                            {item.disabled ? (
                              <Circle className="w-4 h-4 text-[#4b4b4b]" />
                            ) : checked ? (
                              <CheckCircle2 className="w-4 h-4 text-[#5b8def]" />
                            ) : (
                              <Circle className="w-4 h-4 text-[#6b6b6b]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[13px] text-white truncate">{item.title}</div>
                              {badge && (
                                <Badge className={`text-[10px] border-0 ${badge.className}`}>{badge.text}</Badge>
                              )}
                              {item.disabled && <Badge className="text-[10px] bg-[#2d2d2d] border-0 text-[#d0d0d0]">仅预览</Badge>}
                            </div>
                            {item.description && <div className="text-[11px] text-[#808080] mt-1 whitespace-pre-wrap">{item.description}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2d2d2d] text-[#a0a0a0]"
            disabled={isApplying}
          >
            {cancelText || "取消"}
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
            disabled={isApplying || selectedCount === 0}
          >
            {isApplying ? "正在应用..." : confirmText || "确认并应用"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

