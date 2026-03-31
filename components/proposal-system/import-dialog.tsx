"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { useOntologyStore } from "@/stores";
import { toPascalCase } from "@/lib/utils";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";
import type { MetaCore } from "@/lib/meta/meta-core";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = "upload" | "preview" | "mapping" | "complete";

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { addObjectType, neo4jProject, scenario } = useOntologyStore();
  const [step, setStep] = useState<ImportStep>("upload");
  const [jsonData, setJsonData] = useState<Record<string, unknown>[]>([]);
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (Array.isArray(parsed)) {
          setJsonData(parsed);
          setRawJson(text);
          setStep("preview");
          setError(null);
        } else {
          setError("JSON 格式错误：需要是数组格式");
        }
      } catch (err) {
        setError("JSON 解析错误：" + (err as Error).message);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleJsonPaste = useCallback(() => {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        setJsonData(parsed);
        setStep("preview");
        setError(null);
      } else {
        setError("JSON 格式错误：需要是数组格式");
      }
    } catch (err) {
      setError("JSON 解析错误：" + (err as Error).message);
    }
  }, [rawJson]);

  const inferredColumns = React.useMemo(() => {
    if (jsonData.length === 0) return [];
    const firstRow = jsonData[0];
    return Object.keys(firstRow);
  }, [jsonData]);

  const inferredTypes = React.useMemo(() => {
    if (jsonData.length === 0) return {};
    const types: Record<string, string> = {};
    
    jsonData.forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        if (types[key]) return;
        
        if (typeof value === "number") {
          types[key] = Number.isInteger(value) ? "INTEGER" : "DOUBLE";
        } else if (typeof value === "boolean") {
          types[key] = "BOOLEAN";
        } else if (value instanceof Date || (typeof value === "string" && !isNaN(Date.parse(value)))) {
          types[key] = "TIMESTAMP";
        } else {
          types[key] = "STRING";
        }
      });
    });
    
    return types;
  }, [jsonData]);

  const handleImport = useCallback(async () => {
    // Create object type from JSON structure
    const firstRow = jsonData[0];
    const apiName = toPascalCase(Object.keys(firstRow)[0] || "ImportedData");
    
    const newOt = addObjectType({
      apiName,
      displayName: apiName,
      description: `从 JSON 导入的数据，共 ${jsonData.length} 条记录`,
      visibility: "PROJECT",
      primaryKey: "",
      titleKey: "",
      properties: inferredColumns.map((col) => ({
        id: `prop-${col}`,
        apiName: col.replace(/([A-Z])/g, "_$1").toLowerCase(),
        displayName: col,
        baseType: (inferredTypes[col] || "STRING") as any,
        visibility: "NORMAL" as const,
        required: false,
      })),
      layer: "SEMANTIC",
    });

    if (neo4jProject) {
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
        setError(e?.message || "写入 Neo4j 失败");
        return;
      }
    }

    setStep("complete");
  }, [jsonData, inferredColumns, inferredTypes, addObjectType, neo4jProject, scenario]);

  const handleClose = () => {
    setStep("upload");
    setJsonData([]);
    setRawJson("");
    setError(null);
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (step) {
      case "upload":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg text-white">导入数据模型</DialogTitle>
              <DialogDescription className="text-[#6b6b6b]">
                从 JSON 文件导入数据，自动映射到本体对象类型
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-[#2d2d2d] rounded-lg p-8 text-center hover:border-[#5b8def]/50 transition-colors">
                <Upload className="w-10 h-10 mx-auto mb-3 text-[#6b6b6b]" />
                <p className="text-sm text-[#a0a0a0] mb-2">
                  拖放 JSON 文件或点击上传
                </p>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto bg-[#0d0d0d] border-[#2d2d2d]"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-px bg-[#2d2d2d]" />
                </div>
                <span className="text-xs text-[#6b6b6b]">或粘贴 JSON</span>
                <div className="flex-1">
                  <div className="h-px bg-[#2d2d2d]" />
                </div>
              </div>

              {/* Paste Area */}
              <div className="space-y-2">
                <Label className="text-xs text-[#6b6b6b]">粘贴 JSON 数据</Label>
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  placeholder='[{"column1": "value1", "column2": 123}, ...]'
                  className="w-full h-32 p-3 rounded-md bg-[#0d0d0d] border border-[#2d2d2d] text-sm font-mono text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#5b8def]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[#2d2d2d] border-[#3d3d3d] text-[#a0a0a0] hover:bg-[#3d3d3d]"
                  onClick={handleJsonPaste}
                >
                  解析 JSON
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}
            </div>
          </>
        );

      case "preview":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg text-white">数据预览</DialogTitle>
              <DialogDescription className="text-[#6b6b6b]">
                检测到 {jsonData.length} 条记录，将创建对应的对象类型
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {inferredColumns.map((col) => (
                  <div
                    key={col}
                    className="p-2 rounded-md bg-[#0d0d0d] border border-[#2d2d2d]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-white truncate">
                        {col}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        inferredTypes[col] === "INTEGER" || inferredTypes[col] === "DOUBLE"
                          ? "border-green-500/30 text-green-400"
                          : inferredTypes[col] === "BOOLEAN"
                          ? "border-orange-500/30 text-orange-400"
                          : inferredTypes[col] === "TIMESTAMP"
                          ? "border-yellow-500/30 text-yellow-400"
                          : "border-blue-500/30 text-blue-400"
                      )}
                    >
                      {inferredTypes[col]}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="border border-[#2d2d2d] rounded-md overflow-hidden">
                <div className="p-2 bg-[#0d0d0d] border-b border-[#2d2d2d]">
                  <span className="text-xs text-[#6b6b6b]">数据样本</span>
                </div>
                <ScrollArea className="h-40">
                  <pre className="p-3 text-xs font-mono text-[#a0a0a0]">
                    {JSON.stringify(jsonData[0], null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="border-[#2d2d2d] text-[#a0a0a0]"
                onClick={() => setStep("upload")}
              >
                上一步
              </Button>
              <Button
                className="bg-[#5b8def] hover:bg-[#4a7ce0]"
                onClick={handleImport}
              >
                确认导入
              </Button>
            </DialogFooter>
          </>
        );

      case "complete":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                导入完成
              </DialogTitle>
            </DialogHeader>

            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-[#a0a0a0]">
                成功创建对象类型 <span className="text-white font-mono">{toPascalCase(inferredColumns[0] || "ImportedData")}</span>
              </p>
              <p className="text-sm text-[#6b6b6b] mt-2">
                共导入 {jsonData.length} 条记录和 {inferredColumns.length} 个属性
              </p>
            </div>

            <DialogFooter>
              <Button
                className="bg-[#5b8def] hover:bg-[#4a7ce0]"
                onClick={handleClose}
              >
                完成
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-2xl">
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
