"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { useOntologyStore, useProposalStore, useSelectionStore, useUIStore } from "@/stores";
import type { MetaCore } from "@/lib/meta/meta-core";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";

type ImportError = { fileName: string; path: string; message: string };

type ImportReport = {
  parsedCount: number;
  semanticModelCount: number;
  datasetCount: number;
  relationshipCount: number;
  fieldCount: number;
  actionTypeCount: number;
  businessRuleCount: number;
  analysisInsightCount: number;
};

export function OsiImportDialog() {
  const { showOsiImportDialog, setShowOsiImportDialog } = useUIStore();
  const { replaceAll, neo4jProject } = useOntologyStore();
  const { clearAll: clearSelection } = useSelectionStore();
  const { clearAll: clearProposals } = useProposalStore();

  const [files, setFiles] = React.useState<File[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [errors, setErrors] = React.useState<ImportError[]>([]);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [success, setSuccess] = React.useState<string>("");
  const [warning, setWarning] = React.useState<string>("");

  React.useEffect(() => {
    if (!showOsiImportDialog) return;
    setFiles([]);
    setErrors([]);
    setReport(null);
    setSuccess("");
    setWarning("");
    setIsImporting(false);
  }, [showOsiImportDialog]);

  async function onImport() {
    if (!files.length) {
      setErrors([{ fileName: "", path: "", message: "请先上传 OSI YAML 文件" }]);
      return;
    }

    setIsImporting(true);
    setErrors([]);
    setReport(null);
    setSuccess("");
    setWarning("");

    try {
      const filePayload = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          yamlText: await f.text(),
        }))
      );

      const resp = await fetch("/api/osi/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filePayload }),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        setErrors(Array.isArray(data?.errors) ? (data.errors as ImportError[]) : [{ fileName: "", path: "", message: data?.error || "导入失败" }]);
        return;
      }

      const meta = data?.meta as MetaCore;
      const r = data?.report as ImportReport;

      replaceAll(meta);
      clearSelection();
      clearProposals();

      if (neo4jProject) {
        const controller = new AbortController();
        const handle = window.setTimeout(() => controller.abort(), 8000);
        void upsertMetaToNeo4jClient({
          database: neo4jProject.dbName,
          scenario: neo4jProject.dbName,
          reset: true,
          meta,
          signal: controller.signal,
        })
          .catch((e: any) => {
            setWarning(e?.message || "Neo4j 写入失败（已导入到画布，本次仅跳过写入）");
          })
          .finally(() => {
            window.clearTimeout(handle);
          });
      }

      setReport(r || null);
      setSuccess("导入成功，请确认进入画布");
    } catch (e: any) {
      setErrors([{ fileName: "", path: "", message: e?.message || "导入失败" }]);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={showOsiImportDialog} onOpenChange={setShowOsiImportDialog}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">导入 OSI YAML 语义模型</DialogTitle>
          <DialogDescription className="text-[#6b6b6b]">
            严格校验 OSI Core + behavior layer。导入成功后会整包替换当前画布，并在当前 Neo4j 项目上 reset 写入。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-[#2d2d2d] rounded-lg p-6 text-center hover:border-[#5b8def]/50 transition-colors">
            <Upload className="w-8 h-8 mx-auto mb-2 text-[#6b6b6b]" />
            <div className="text-sm text-[#a0a0a0]">选择一个或多个 .yaml/.yml</div>
            <Input
              type="file"
              accept=".yaml,.yml"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="max-w-xs mx-auto mt-3 bg-[#0d0d0d] border-[#2d2d2d]"
              disabled={Boolean(success) || isImporting}
            />
          </div>

          {files.length ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <Badge key={f.name} variant="secondary" className="bg-[#2d2d2d] text-[#a0a0a0] border-[#3d3d3d]">
                  {f.name}
                </Badge>
              ))}
            </div>
          ) : null}

          {report ? (
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">models: {report.semanticModelCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">datasets: {report.datasetCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">relationships: {report.relationshipCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">fields: {report.fieldCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">actions: {report.actionTypeCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">rules: {report.businessRuleCount}</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">metrics: {report.analysisInsightCount}</Badge>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#10B981]/10 border border-[#10B981]/20">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <div className="text-sm text-[#10B981]">{success}</div>
            </div>
          ) : null}

          {warning ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
              <div className="text-sm text-[#F59E0B]">{warning}</div>
            </div>
          ) : null}

          {errors.length ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 overflow-hidden">
              <div className="px-3 py-2 border-b border-red-500/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <div className="text-sm text-red-400">导入失败（严格校验未通过）</div>
              </div>
              <ScrollArea className="h-[220px]">
                <div className="p-3 space-y-2">
                  {errors.slice(0, 120).map((e, idx) => (
                    <div key={`${e.fileName}-${e.path}-${idx}`} className="text-xs text-red-200">
                      <span className="text-red-300">{e.fileName || "文件"}</span>
                      {e.path ? <span className="text-red-400"> {e.path}</span> : null}
                      <span className="text-red-200"> {e.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          {success ? (
            <Button className="bg-[#10B981] hover:bg-[#059669] text-white" onClick={() => setShowOsiImportDialog(false)}>
              进入画布
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="bg-[#2d2d2d] border-[#3d3d3d] text-[#a0a0a0] hover:bg-[#3d3d3d]"
                onClick={() => setShowOsiImportDialog(false)}
                disabled={isImporting}
              >
                取消
              </Button>
              <Button className="bg-[#5b8def] hover:bg-[#3d6bc7] text-white" onClick={onImport} disabled={isImporting}>
                {isImporting ? "导入中…" : "导入并应用"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
