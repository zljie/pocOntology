"use client";

import React, { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useOntologyStore } from "@/stores";
import { MetaCore, diffMetaCore, validateMetaCore } from "@/lib/meta/meta-core";
import { generateDataDictionaryMarkdown, generatePostgresDDL } from "@/lib/orm/postgres";

interface MetaToolboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function scenarioLabel(value: string) {
  if (value === "library") return "图书馆";
  if (value === "erp") return "ERP";
  return "自定义";
}

export function MetaToolboxSheet({ open, onOpenChange }: MetaToolboxSheetProps) {
  const {
    objectTypes,
    linkTypes,
    actionTypes,
    dataFlows,
    businessRules,
    aiModels,
    analysisInsights,
    scenario,
    replaceAll,
    metaSnapshots,
    createMetaSnapshot,
    deleteMetaSnapshot,
    ormMapping,
    resetOrmMapping,
    updateOrmTable,
    updateOrmColumn,
    updateOrmLink,
  } = useOntologyStore();

  const metaCore: MetaCore = useMemo(
    () => ({
      scenario,
      objectTypes,
      linkTypes,
      actionTypes,
      dataFlows,
      businessRules,
      aiModels,
      analysisInsights,
    }),
    [scenario, objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels, analysisInsights]
  );

  const [activeTab, setActiveTab] = useState("export");
  const [importError, setImportError] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [fromSnapshotId, setFromSnapshotId] = useState<string>("");
  const [toSnapshotId, setToSnapshotId] = useState<string>("");
  const [diffMarkdown, setDiffMarkdown] = useState<string>("");
  const [validationIssues, setValidationIssues] = useState<ReturnType<typeof validateMetaCore> | null>(null);
  const [ddlText, setDdlText] = useState<string>("");
  const [ddlWarnings, setDdlWarnings] = useState<string[]>([]);
  const [dictText, setDictText] = useState<string>("");

  const issues = validationIssues || validateMetaCore(metaCore);
  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warnCount = issues.filter((i) => i.severity === "WARN").length;

  const handleExport = () => {
    const exportedAt = new Date().toISOString();
    const metaModule = {
      moduleVersion: "v1",
      exportedAt,
      scenario: metaCore.scenario,
      meta: metaCore,
    };
    downloadText(
      `meta-module-${scenarioLabel(metaCore.scenario || "custom")}-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify(metaModule, null, 2)
    );
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = JSON.parse(text);
        const candidate = parsed?.meta ? parsed.meta : parsed;
        const next: MetaCore = {
          scenario: candidate?.scenario,
          objectTypes: Array.isArray(candidate?.objectTypes) ? candidate.objectTypes : [],
          linkTypes: Array.isArray(candidate?.linkTypes) ? candidate.linkTypes : [],
          actionTypes: Array.isArray(candidate?.actionTypes) ? candidate.actionTypes : [],
          dataFlows: Array.isArray(candidate?.dataFlows) ? candidate.dataFlows : [],
          businessRules: Array.isArray(candidate?.businessRules) ? candidate.businessRules : [],
          aiModels: Array.isArray(candidate?.aiModels) ? candidate.aiModels : [],
          analysisInsights: Array.isArray(candidate?.analysisInsights) ? candidate.analysisInsights : [],
        };
        replaceAll(next);
        setImportError(null);
      } catch (err) {
        setImportError((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const snapshotOptions = metaSnapshots;
  const fromSnapshot = snapshotOptions.find((s) => s.id === fromSnapshotId);
  const toSnapshot = snapshotOptions.find((s) => s.id === toSnapshotId);

  const generateDiff = () => {
    if (!fromSnapshot || !toSnapshot) return;
    const diff = diffMetaCore(
      { name: `${fromSnapshot.name} (${fromSnapshot.createdAt.slice(0, 19)})`, meta: fromSnapshot.meta },
      { name: `${toSnapshot.name} (${toSnapshot.createdAt.slice(0, 19)})`, meta: toSnapshot.meta }
    );
    setDiffMarkdown(diff.markdown);
  };

  const createSnapshot = () => {
    const snap = createMetaSnapshot(snapshotName);
    setSnapshotName("");
    setFromSnapshotId(snap.id);
    setToSnapshotId(snap.id);
  };

  const runValidation = () => {
    setValidationIssues(validateMetaCore(metaCore));
  };

  const buildDdl = () => {
    const out = generatePostgresDDL(metaCore, ormMapping || undefined);
    setDdlText(out.ddl);
    setDdlWarnings(out.warnings);
  };

  const buildDictionary = () => {
    setDictText(generateDataDictionaryMarkdown(metaCore, ormMapping || undefined));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} showOverlay={false}>
      <SheetContent className="w-[860px] sm:w-[920px] bg-[#0d0d0d] border-[#2d2d2d] p-0" onOpenChange={onOpenChange}>
        <SheetHeader className="px-6 py-4 border-b border-[#2d2d2d]">
          <SheetTitle className="text-white text-base">Meta 工具箱</SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
              {scenarioLabel(scenario)}
            </Badge>
            <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
              {objectTypes.length} Object
            </Badge>
            <Badge variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
              {linkTypes.length} Link
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "border",
                errorCount > 0
                  ? "bg-red-500/10 text-red-300 border-red-500/20"
                  : warnCount > 0
                  ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                  : "bg-green-500/10 text-green-300 border-green-500/20"
              )}
            >
              {errorCount} 错误 / {warnCount} 警告
            </Badge>
          </div>
        </SheetHeader>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#161614] border border-[#2d2d2d]">
              <TabsTrigger value="export" className="data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white">
                导入/导出
              </TabsTrigger>
              <TabsTrigger value="validate" className="data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white">
                质量闸门
              </TabsTrigger>
              <TabsTrigger value="diff" className="data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white">
                版本 Diff
              </TabsTrigger>
              <TabsTrigger value="orm" className="data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white">
                DB/字典
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">模块化导出</div>
                    <div className="text-xs text-[#6b6b6b]">导出当前 Meta Core 为可导入模块 JSON</div>
                  </div>
                  <Button className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white" onClick={handleExport}>
                    导出模块 JSON
                  </Button>
                </div>

                <div className="border border-[#2d2d2d] rounded-lg p-4 bg-[#161614]">
                  <div className="text-sm text-white mb-2">导入模块</div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept=".json"
                      className="bg-[#0d0d0d] border-[#2d2d2d] text-[#a0a0a0]"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        handleImportFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                  {importError && (
                    <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md p-2">
                      导入失败：{importError}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-[#6b6b6b]">导入将替换当前模型（object/link/action/flow/rule 等）。</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="validate">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">Meta Core 质量闸门</div>
                    <div className="text-xs text-[#6b6b6b]">命名 / 引用 / 基数 / 类型合法性校验</div>
                  </div>
                  <Button variant="outline" className="bg-[#161614] border-[#2d2d2d] text-white" onClick={runValidation}>
                    运行校验
                  </Button>
                </div>

                <div className="border border-[#2d2d2d] rounded-lg bg-[#161614]">
                  <ScrollArea className="h-[420px] p-4">
                    {issues.length === 0 ? (
                      <div className="text-sm text-[#a0a0a0]">未发现问题。</div>
                    ) : (
                      <div className="space-y-2">
                        {issues.map((it, idx) => (
                          <div
                            key={`${it.code}-${idx}`}
                            className={cn(
                              "rounded-md border p-3",
                              it.severity === "ERROR"
                                ? "bg-red-500/10 border-red-500/20"
                                : "bg-yellow-500/10 border-yellow-500/20"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-white">{it.message}</div>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "border",
                                  it.severity === "ERROR"
                                    ? "bg-red-500/10 text-red-300 border-red-500/20"
                                    : "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                                )}
                              >
                                {it.code}
                              </Badge>
                            </div>
                            {it.path && <div className="text-xs text-[#a0a0a0] mt-1">{it.path}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="diff">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">版本快照与 Diff</div>
                    <div className="text-xs text-[#6b6b6b]">创建快照后可生成可读变更报告</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="快照名称（可选）"
                      className="w-64 bg-[#0d0d0d] border-[#2d2d2d] text-white"
                    />
                    <Button className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white" onClick={createSnapshot}>
                      创建快照
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-xs text-[#6b6b6b]">From</div>
                    <Select value={fromSnapshotId} onValueChange={setFromSnapshotId}>
                      <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-white">
                        <SelectValue placeholder="选择快照" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161614] border-[#2d2d2d] text-white">
                        {snapshotOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="focus:bg-[#2d2d2d]">
                            {s.name} ({s.createdAt.slice(0, 19)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-[#6b6b6b]">To</div>
                    <Select value={toSnapshotId} onValueChange={setToSnapshotId}>
                      <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-white">
                        <SelectValue placeholder="选择快照" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161614] border-[#2d2d2d] text-white">
                        {snapshotOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="focus:bg-[#2d2d2d]">
                            {s.name} ({s.createdAt.slice(0, 19)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="bg-[#161614] border-[#2d2d2d] text-white"
                    onClick={generateDiff}
                    disabled={!fromSnapshotId || !toSnapshotId}
                  >
                    生成 Diff 报告
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="bg-[#161614] border-[#2d2d2d] text-white"
                      disabled={!diffMarkdown}
                      onClick={() => downloadText("meta-diff.md", diffMarkdown, "text/markdown")}
                    >
                      导出 Markdown
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-[#161614] border-[#2d2d2d] text-white"
                      disabled={!fromSnapshot}
                      onClick={() => {
                        if (!fromSnapshot) return;
                        deleteMetaSnapshot(fromSnapshot.id);
                        if (fromSnapshotId === fromSnapshot.id) setFromSnapshotId("");
                        if (toSnapshotId === fromSnapshot.id) setToSnapshotId("");
                      }}
                    >
                      删除 From
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-[#161614] border-[#2d2d2d] text-white"
                      disabled={!toSnapshot || toSnapshot?.id === fromSnapshot?.id}
                      onClick={() => {
                        if (!toSnapshot) return;
                        deleteMetaSnapshot(toSnapshot.id);
                        if (fromSnapshotId === toSnapshot.id) setFromSnapshotId("");
                        if (toSnapshotId === toSnapshot.id) setToSnapshotId("");
                      }}
                    >
                      删除 To
                    </Button>
                  </div>
                </div>

                <Textarea value={diffMarkdown} readOnly className="h-[320px] bg-[#0d0d0d] border-[#2d2d2d] text-white font-mono" />
              </div>
            </TabsContent>

            <TabsContent value="orm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">ORM Layer v1（PostgreSQL）</div>
                    <div className="text-xs text-[#6b6b6b]">映射编辑器 + DDL + 数据字典导出</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="bg-[#161614] border-[#2d2d2d] text-white" onClick={resetOrmMapping}>
                      重置映射
                    </Button>
                    <Button className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white" onClick={buildDdl}>
                      生成 DDL
                    </Button>
                    <Button className="bg-[#5b8def] hover:bg-[#4a7dd8] text-white" onClick={buildDictionary}>
                      生成数据字典
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-[#2d2d2d] rounded-lg bg-[#161614]">
                    <div className="px-4 py-3 border-b border-[#2d2d2d] text-sm text-white">映射编辑器</div>
                    <ScrollArea className="h-[520px] p-4">
                      <div className="space-y-3">
                        {objectTypes.map((ot) => {
                          const table = ormMapping?.tables?.[ot.id];
                          if (!table) return null;
                          return (
                            <Collapsible key={ot.id} defaultOpen={false} className="border border-[#2d2d2d] rounded-md">
                              <CollapsibleTrigger asChild>
                                <button className="w-full text-left px-3 py-2 flex items-center justify-between bg-[#0d0d0d]">
                                  <div className="text-sm text-white">{ot.displayName || ot.apiName}</div>
                                  <div className="text-xs text-[#6b6b6b]">{table.tableName}</div>
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="p-3 space-y-3">
                                <div className="space-y-2">
                                  <div className="text-xs text-[#6b6b6b]">表名</div>
                                  <Input
                                    value={table.tableName}
                                    onChange={(e) => updateOrmTable(ot.id, { tableName: e.target.value })}
                                    className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <div className="text-xs text-[#6b6b6b]">主键策略</div>
                                    <Select
                                      value={table.primaryKeyStrategy}
                                      onValueChange={(v) =>
                                        updateOrmTable(ot.id, {
                                          primaryKeyStrategy: v as any,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#161614] border-[#2d2d2d] text-white">
                                        <SelectItem value="PROPERTY" className="focus:bg-[#2d2d2d]">
                                          使用属性
                                        </SelectItem>
                                        <SelectItem value="UUID" className="focus:bg-[#2d2d2d]">
                                          UUID
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-xs text-[#6b6b6b]">主键列名</div>
                                    <Input
                                      value={table.primaryKeyColumnName || ""}
                                      onChange={(e) => updateOrmTable(ot.id, { primaryKeyColumnName: e.target.value })}
                                      className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                      placeholder="id"
                                    />
                                  </div>
                                </div>

                                {table.primaryKeyStrategy === "PROPERTY" && (
                                  <div className="space-y-2">
                                    <div className="text-xs text-[#6b6b6b]">主键属性</div>
                                    <Select
                                      value={table.primaryKeyPropertyId || ""}
                                      onValueChange={(v) => updateOrmTable(ot.id, { primaryKeyPropertyId: v })}
                                    >
                                      <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-white">
                                        <SelectValue placeholder="选择属性" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#161614] border-[#2d2d2d] text-white">
                                        {ot.properties.map((p) => (
                                          <SelectItem key={p.id} value={p.id} className="focus:bg-[#2d2d2d]">
                                            {p.displayName || p.apiName} ({p.apiName})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <div className="text-xs text-[#6b6b6b]">字段映射</div>
                                <div className="space-y-2">
                                  {ot.properties.map((p) => {
                                    const col = table.columns[p.id];
                                    if (!col) return null;
                                    return (
                                      <div key={p.id} className="grid grid-cols-2 gap-2">
                                        <Input
                                          value={col.columnName}
                                          onChange={(e) => updateOrmColumn(ot.id, p.id, { columnName: e.target.value })}
                                          className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                          placeholder={p.apiName}
                                        />
                                        <Input
                                          value={col.sqlType || ""}
                                          onChange={(e) => updateOrmColumn(ot.id, p.id, { sqlType: e.target.value })}
                                          className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                          placeholder="SQL 类型（可选）"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}

                        {linkTypes.length > 0 && (
                          <div className="border border-[#2d2d2d] rounded-md">
                            <div className="px-3 py-2 bg-[#0d0d0d] text-sm text-white">关系映射</div>
                            <div className="p-3 space-y-3">
                              {linkTypes.map((lt) => {
                                const linkMap = ormMapping?.links?.[lt.id];
                                if (!linkMap) return null;
                                return (
                                  <Collapsible key={lt.id} defaultOpen={false} className="border border-[#2d2d2d] rounded-md">
                                    <CollapsibleTrigger asChild>
                                      <button className="w-full text-left px-3 py-2 flex items-center justify-between bg-[#0d0d0d]">
                                        <div className="text-sm text-white">{lt.displayName || lt.apiName}</div>
                                        <div className="text-xs text-[#6b6b6b]">{lt.cardinality}</div>
                                      </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="p-3 space-y-2">
                                      {lt.cardinality === "MANY_TO_MANY" ? (
                                        <>
                                          <div className="text-xs text-[#6b6b6b]">中间表</div>
                                          <Input
                                            value={linkMap.joinTableName || ""}
                                            onChange={(e) => updateOrmLink(lt.id, { joinTableName: e.target.value })}
                                            className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                            placeholder="join_table"
                                          />
                                          <div className="grid grid-cols-2 gap-2">
                                            <Input
                                              value={linkMap.joinSourceColumnName || ""}
                                              onChange={(e) => updateOrmLink(lt.id, { joinSourceColumnName: e.target.value })}
                                              className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                              placeholder="source_id"
                                            />
                                            <Input
                                              value={linkMap.joinTargetColumnName || ""}
                                              onChange={(e) => updateOrmLink(lt.id, { joinTargetColumnName: e.target.value })}
                                              className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                              placeholder="target_id"
                                            />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-2">
                                              <div className="text-xs text-[#6b6b6b]">外键落在哪边</div>
                                              <Select
                                                value={linkMap.foreignKeyPlacement}
                                                onValueChange={(v) => updateOrmLink(lt.id, { foreignKeyPlacement: v as any })}
                                              >
                                                <SelectTrigger className="bg-[#0d0d0d] border-[#2d2d2d] text-white">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#161614] border-[#2d2d2d] text-white">
                                                  <SelectItem value="SOURCE" className="focus:bg-[#2d2d2d]">
                                                    SOURCE
                                                  </SelectItem>
                                                  <SelectItem value="TARGET" className="focus:bg-[#2d2d2d]">
                                                    TARGET
                                                  </SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-2">
                                              <div className="text-xs text-[#6b6b6b]">外键列名</div>
                                              <Input
                                                value={linkMap.foreignKeyColumnName || ""}
                                                onChange={(e) => updateOrmLink(lt.id, { foreignKeyColumnName: e.target.value })}
                                                className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                                                placeholder="fk_column"
                                              />
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="border border-[#2d2d2d] rounded-lg bg-[#161614]">
                    <div className="px-4 py-3 border-b border-[#2d2d2d] text-sm text-white flex items-center justify-between">
                      <div>导出产物</div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                          disabled={!ddlText}
                          onClick={() => downloadText("schema.sql", ddlText, "text/plain")}
                        >
                          导出 DDL
                        </Button>
                        <Button
                          variant="outline"
                          className="bg-[#0d0d0d] border-[#2d2d2d] text-white"
                          disabled={!dictText}
                          onClick={() => downloadText("data-dictionary.md", dictText, "text/markdown")}
                        >
                          导出数据字典
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[520px] p-4">
                      <div className="space-y-3">
                        {ddlWarnings.length > 0 && (
                          <div className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2">
                            {ddlWarnings.map((w, i) => (
                              <div key={i}>{w}</div>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-[#6b6b6b]">DDL</div>
                        <Textarea value={ddlText} readOnly className="h-[220px] bg-[#0d0d0d] border-[#2d2d2d] text-white font-mono" />
                        <div className="text-xs text-[#6b6b6b]">数据字典</div>
                        <Textarea value={dictText} readOnly className="h-[220px] bg-[#0d0d0d] border-[#2d2d2d] text-white font-mono" />
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
