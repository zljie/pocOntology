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
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";
import { useConsultingStore, useOntologyStore, useProposalStore, useSelectionStore, useUIStore } from "@/stores";
import type { MetaCore } from "@/lib/meta/meta-core";
import { upsertMetaToNeo4jClient } from "@/lib/neo4j/client";

type ImportError = { fileName?: string; path?: string; message: string };
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

export function StartupImportDialog() {
  const { showStartupImportDialog, setShowStartupImportDialog, setShowOsiImportDialog } = useUIStore();
  const { replaceAll, neo4jProject } = useOntologyStore();
  const { clearAll: clearSelection } = useSelectionStore();
  const { clearAll: clearProposals } = useProposalStore();
  const { clear: clearConsulting, addDomain, toggleEntityInDomain, selectDomain } = useConsultingStore();

  const [isLoading, setIsLoading] = React.useState(false);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [success, setSuccess] = React.useState("");
  const [warning, setWarning] = React.useState("");
  const [error, setError] = React.useState<ImportError | null>(null);

  React.useEffect(() => {
    if (!showStartupImportDialog) return;
    setIsLoading(false);
    setReport(null);
    setSuccess("");
    setWarning("");
    setError(null);
  }, [showStartupImportDialog]);

  async function applyMeta(meta: MetaCore, r: ImportReport | null, domainName?: string) {
    replaceAll(meta);
    clearSelection();
    clearProposals();
    clearConsulting();

    // 导入后以“导入选择的模型业务域”为主：默认创建一个业务域，包含全部实体，避免遗留业务域与新本体不匹配
    const name = (domainName || "当前导入模型").trim();
    const domainId = addDomain(name);
    for (const ot of meta.objectTypes || []) {
      toggleEntityInDomain(domainId, ot.id);
    }
    selectDomain(domainId);

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
          setWarning(e?.message || "Neo4j 写入失败（已加载到画布，本次仅跳过写入）");
        })
        .finally(() => window.clearTimeout(handle));
    }

    setReport(r);
    setSuccess("加载成功，请确认进入画布");
  }

  async function loadSample(sampleId: "pp" | "food") {
    setIsLoading(true);
    setError(null);
    setWarning("");
    setReport(null);
    setSuccess("");

    try {
      const resp = await fetch("/api/osi/import-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const first = Array.isArray(data?.errors) ? data.errors[0] : null;
        setError({
          fileName: first?.fileName,
          path: first?.path,
          message: first?.message || data?.error || "加载失败",
        });
        return;
      }
      await applyMeta(
        data?.meta as MetaCore,
        (data?.report as ImportReport) || null,
        sampleId === "pp" ? "采购管理（PP）" : "餐饮管理（Food）"
      );
    } catch (e: any) {
      setError({ message: e?.message || "加载失败" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={showStartupImportDialog} onOpenChange={setShowStartupImportDialog}>
      <DialogContent className="bg-[#1a1a18] border-[#2d2d2d] text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">选择加载方式</DialogTitle>
          <DialogDescription className="text-[#6b6b6b]">
            你可以加载一个内置示例，或上传 OSI YAML 文件导入到画布。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            className="text-left rounded-lg border border-[#2d2d2d] bg-[#0d0d0d] hover:bg-[#121212] transition-colors p-4 disabled:opacity-60"
            onClick={() => loadSample("pp")}
            disabled={isLoading || Boolean(success)}
          >
            <div className="text-sm font-semibold text-white">示例一：采购管理（PP）</div>
            <div className="mt-1 text-xs text-[#9a9a9a]">pp_semantic_model_semantic_v3.yaml</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">Procurement</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">P2P</Badge>
            </div>
          </button>

          <button
            className="text-left rounded-lg border border-[#2d2d2d] bg-[#0d0d0d] hover:bg-[#121212] transition-colors p-4 disabled:opacity-60"
            onClick={() => loadSample("food")}
            disabled={isLoading || Boolean(success)}
          >
            <div className="text-sm font-semibold text-white">示例二：餐饮管理（Food）</div>
            <div className="mt-1 text-xs text-[#9a9a9a]">food_semantic_model_semantic_v2.yaml</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">Restaurant</Badge>
              <Badge className="bg-[#111827] text-[#93c5fd] border border-[#1f2937]">Ops</Badge>
            </div>
          </button>

          <button
            className="text-left rounded-lg border border-[#2d2d2d] bg-[#0d0d0d] hover:bg-[#121212] transition-colors p-4 disabled:opacity-60"
            onClick={() => {
              setShowStartupImportDialog(false);
              setShowOsiImportDialog(true);
            }}
            disabled={isLoading || Boolean(success)}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UploadCloud className="w-4 h-4" />
              上传文件加载
            </div>
            <div className="mt-1 text-xs text-[#9a9a9a]">上传一个或多个 .yaml/.yml</div>
          </button>
        </div>

        {report ? (
          <div className="flex flex-wrap gap-2 mt-2">
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

        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
            <div className="text-sm text-red-200">
              <div className="text-red-300">{error.message}</div>
              {error.fileName || error.path ? (
                <div className="text-xs text-red-300/80 mt-1">
                  {[error.fileName, error.path].filter(Boolean).join(" ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {success ? (
            <Button className="bg-[#10B981] hover:bg-[#059669] text-white" onClick={() => setShowStartupImportDialog(false)}>
              进入画布
            </Button>
          ) : (
            <Button
              variant="outline"
              className="bg-[#2d2d2d] border-[#3d3d3d] text-[#a0a0a0] hover:bg-[#3d3d3d]"
              onClick={() => setShowStartupImportDialog(false)}
              disabled={isLoading}
            >
              稍后再说
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
