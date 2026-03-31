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
import { toPascalCase, isPascalCase } from "@/lib/utils";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { MetaCore } from "@/lib/meta/meta-core";

interface CreateObjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editObjectType?: {
    id: string;
    displayName: string;
    apiName: string;
    description?: string;
    visibility: "PRIVATE" | "PROJECT" | "GLOBAL";
  };
}

export function CreateObjectTypeDialog({
  open,
  onOpenChange,
  editObjectType,
}: CreateObjectTypeDialogProps) {
  const { addObjectType, updateObjectType, neo4jProject, scenario } = useOntologyStore();
  const [displayName, setDisplayName] = useState(
    editObjectType?.displayName || ""
  );
  const [apiName, setApiName] = useState(editObjectType?.apiName || "");
  const [description, setDescription] = useState(
    editObjectType?.description || ""
  );
  const [visibility, setVisibility] = useState<
    "PRIVATE" | "PROJECT" | "GLOBAL"
  >(editObjectType?.visibility || "PROJECT");
  const [neo4jError, setNeo4jError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!editObjectType) {
      setApiName(toPascalCase(value));
    }
  };

  const isValid =
    displayName.trim() &&
    apiName.trim() &&
    isPascalCase(apiName);

  const handleSubmit = async () => {
    if (!isValid) return;
    setNeo4jError(null);

    if (editObjectType) {
      updateObjectType(editObjectType.id, {
        displayName,
        apiName,
        description,
        visibility,
      });
    } else {
      const newOt = addObjectType({
        displayName,
        apiName,
        description,
        visibility,
        primaryKey: "",
        titleKey: "",
        properties: [],
        layer: "SEMANTIC",
      });

      if (neo4jProject) {
        setIsSyncing(true);
        try {
          const meta: MetaCore = {
            scenario,
            objectTypes: [newOt],
            linkTypes: [],
            actionTypes: [],
            dataFlows: [],
            businessRules: [],
            aiModels: [],
            analysisInsights: [],
          };
          await upsertMetaToNeo4jClient({
            database: neo4jProject.dbName,
            scenario: neo4jProject.dbName,
            meta,
          });
        } catch (e: any) {
          setNeo4jError(e?.message || "写入 Neo4j 失败");
          setIsSyncing(false);
          return;
        } finally {
          setIsSyncing(false);
        }
      }
    }

    // Reset form
    setDisplayName("");
    setApiName("");
    setDescription("");
    setVisibility("PROJECT");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editObjectType ? "编辑对象类型" : "创建对象类型"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm text-[#a0a0a0]">
              显示名称
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="例如：用户信息"
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
            />
          </div>

          {/* API Name */}
          <div className="space-y-2">
            <Label htmlFor="apiName" className="text-sm text-[#a0a0a0]">
              API 名称
              <span className="text-[#6b6b6b] ml-2 text-xs">(PascalCase)</span>
            </Label>
            <Input
              id="apiName"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              placeholder="例如：UserInfo"
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white font-mono"
            />
            {apiName && !isPascalCase(apiName) && (
              <p className="text-xs text-red-400">
                API 名称必须以大写字母开头，只包含字母和数字
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm text-[#a0a0a0]">
              描述
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个对象类型的用途..."
              className="bg-[#0d0d0d] border-[#2d2d2d] text-white min-h-[80px]"
            />
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0]">可见性</Label>
            <Select
              value={visibility}
              onValueChange={(value: "PRIVATE" | "PROJECT" | "GLOBAL") =>
                setVisibility(value)
              }
            >
              <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a18] border-[#2d2d2d]">
                <SelectItem value="PRIVATE">
                  <span className="text-red-400">私有</span> - 仅创建者可见
                </SelectItem>
                <SelectItem value="PROJECT">
                  <span className="text-yellow-400">项目级</span> - 项目成员可见
                </SelectItem>
                <SelectItem value="GLOBAL">
                  <span className="text-green-400">全局</span> - 所有用户可见
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {neo4jError && <div className="text-sm text-red-400">{neo4jError}</div>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2d2d2d] text-[#a0a0a0]"
            disabled={isSyncing}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSyncing}
            className="bg-[#5b8def] hover:bg-[#4a7ce0]"
          >
            {isSyncing ? "同步中…" : editObjectType ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
