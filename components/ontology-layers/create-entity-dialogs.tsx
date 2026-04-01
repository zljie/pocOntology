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
import { Textarea } from "@/components/ui/textarea";
import { useOntologyStore } from "@/stores";
import { toPascalCase, isPascalCase } from "@/lib/utils";
import { CreateActionTypeWizard } from "./create-action-type-wizard";

// Generic Dialog Props
interface BaseCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActionTypeDialog({ open, onOpenChange }: BaseCreateDialogProps) {
  return <CreateActionTypeWizard open={open} onOpenChange={onOpenChange} />;
}

export function CreateDataFlowDialog({ open, onOpenChange }: BaseCreateDialogProps) {
  const { addDataFlow } = useOntologyStore();
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setApiName(toPascalCase(value));
  };

  const isValid = displayName.trim() && apiName.trim() && isPascalCase(apiName);

  const handleSubmit = () => {
    if (!isValid) return;
    addDataFlow({
      displayName,
      apiName,
      description,
      steps: [],
      flowDirection: "FORWARD",
      visibility: "PROJECT",
      layer: "KINETIC",
    });
    setDisplayName("");
    setApiName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader><DialogTitle>创建数据流 (Data Flow)</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">显示名称</Label>
            <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">API 名称 <span className="text-xs text-[#6b6b6b]">(PascalCase)</span></Label>
            <Input value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2d2d2d] text-[#a0a0a0]">取消</Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="bg-[#10B981] hover:bg-[#059669] text-white">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateBusinessRuleDialog({ open, onOpenChange }: BaseCreateDialogProps) {
  const { addBusinessRule } = useOntologyStore();
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setApiName(toPascalCase(value));
  };

  const isValid = displayName.trim() && apiName.trim() && isPascalCase(apiName);

  const handleSubmit = () => {
    if (!isValid) return;
    addBusinessRule({
      displayName,
      apiName,
      description,
      ruleType: "VALIDATION",
      appliesToObjectTypeIds: [],
      priority: 50,
      enabled: true,
      visibility: "PROJECT",
      layer: "DYNAMIC",
    });
    setDisplayName("");
    setApiName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader><DialogTitle>创建业务规则 (Business Rule)</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">显示名称</Label>
            <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">API 名称 <span className="text-xs text-[#6b6b6b]">(PascalCase)</span></Label>
            <Input value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2d2d2d] text-[#a0a0a0]">取消</Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateAIModelDialog({ open, onOpenChange }: BaseCreateDialogProps) {
  const { addAIModel } = useOntologyStore();
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setApiName(toPascalCase(value));
  };

  const isValid = displayName.trim() && apiName.trim() && isPascalCase(apiName);

  const handleSubmit = () => {
    if (!isValid) return;
    addAIModel({
      displayName,
      apiName,
      description,
      modelType: "PREDICTION",
      inputFeatures: [],
      outputType: "SCORE",
      modelSource: "CUSTOM_TRAINED",
      visibility: "PROJECT",
      layer: "DYNAMIC",
    });
    setDisplayName("");
    setApiName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader><DialogTitle>创建 AI 模型 (AI Model)</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">显示名称</Label>
            <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">API 名称 <span className="text-xs text-[#6b6b6b]">(PascalCase)</span></Label>
            <Input value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2d2d2d] text-[#a0a0a0]">取消</Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateAnalysisInsightDialog({ open, onOpenChange }: BaseCreateDialogProps) {
  const { addAnalysisInsight } = useOntologyStore();
  const [displayName, setDisplayName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setApiName(toPascalCase(value));
  };

  const isValid = displayName.trim() && apiName.trim() && isPascalCase(apiName);

  const handleSubmit = () => {
    if (!isValid) return;
    addAnalysisInsight({
      displayName,
      apiName,
      description,
      insightType: "DASHBOARD",
      dataSources: [],
      visibility: "PROJECT",
      layer: "DYNAMIC",
    });
    setDisplayName("");
    setApiName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader><DialogTitle>创建分析洞察 (Analysis Insight)</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">显示名称</Label>
            <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">API 名称 <span className="text-xs text-[#6b6b6b]">(PascalCase)</span></Label>
            <Input value={apiName} onChange={(e) => setApiName(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d] font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#0d0d0d] border-[#2d2d2d]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2d2d2d] text-[#a0a0a0]">取消</Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
