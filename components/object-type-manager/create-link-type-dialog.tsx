"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOntologyStore } from "@/stores";
import { isPascalCase } from "@/lib/utils";
import { Cardinality } from "@/lib/types/ontology";

interface CreateLinkTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLinkTypeDialog({
  open,
  onOpenChange,
}: CreateLinkTypeDialogProps) {
  const { objectTypes, addLinkType } = useOntologyStore();
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceTypeId, setSourceTypeId] = useState("");
  const [targetTypeId, setTargetTypeId] = useState("");
  const [cardinality, setCardinality] = useState<Cardinality>("ONE_TO_ONE");

  const isValid =
    displayName.trim() &&
    apiName.trim() &&
    isPascalCase(apiName) &&
    sourceTypeId &&
    targetTypeId;

  const handleSubmit = () => {
    if (!isValid) return;

    addLinkType({
      apiName,
      displayName,
      description,
      sourceTypeId,
      targetTypeId,
      cardinality,
      foreignKeyPropertyId: "",
      properties: [],
      visibility: "PROJECT",
      layer: "SEMANTIC",
    });

    // Reset form
    setDisplayName("");
    setApiName("");
    setDescription("");
    setSourceTypeId("");
    setTargetTypeId("");
    setCardinality("ONE_TO_ONE");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg">创建关系类型</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm text-[#a0a0a0]">
              显示名称
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如：所属部门"
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiName" className="text-sm text-[#a0a0a0]">
              全局 API 名称
              <span className="text-[#6b6b6b] ml-2 text-xs">(PascalCase)</span>
            </Label>
            <Input
              id="apiName"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              placeholder="例如：BelongsToDepartment"
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white font-mono"
            />
            {apiName && !isPascalCase(apiName) && (
              <p className="text-xs text-red-400">
                API 名称必须以大写字母开头，只包含字母和数字
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#a0a0a0]">起始对象 (Source)</Label>
              <Select value={sourceTypeId} onValueChange={setSourceTypeId}>
                <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                  <SelectValue placeholder="选择起始对象" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                  {objectTypes.map((ot) => (
                    <SelectItem key={ot.id} value={ot.id}>
                      {ot.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-[#a0a0a0]">目标对象 (Target)</Label>
              <Select value={targetTypeId} onValueChange={setTargetTypeId}>
                <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                  <SelectValue placeholder="选择目标对象" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                  {objectTypes.map((ot) => (
                    <SelectItem key={ot.id} value={ot.id}>
                      {ot.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">基数</Label>
            <Select
              value={cardinality}
              onValueChange={(val) => setCardinality(val as Cardinality)}
            >
              <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                <SelectItem value="ONE_TO_ONE">1:1 (一对一)</SelectItem>
                <SelectItem value="ONE_TO_MANY">1:N (一对多)</SelectItem>
                <SelectItem value="MANY_TO_ONE">N:1 (多对一)</SelectItem>
                <SelectItem value="MANY_TO_MANY">M:N (多对多)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm text-[#a0a0a0]">
              描述
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个关系类型的用途..."
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2d2d2d] text-[#a0a0a0]"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="bg-[#5b8def] hover:bg-[#4a7ce0]"
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}