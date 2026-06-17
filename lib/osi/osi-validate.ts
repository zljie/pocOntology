import "server-only";

import { load as loadYaml } from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { OsiCoreDocument, OsiFileInput, OsiImportError } from "@/lib/osi/osi-import-types";
import { OSI_SCHEMA_TEXT, BEHAVIOR_SCHEMA_TEXT } from "@/lib/osi/samples/schemas";

function toError(fileName: string, message: string, pointer = ""): OsiImportError {
  return { fileName, path: pointer || "", message };
}

function normalizeAjvPointer(pointer: string | undefined) {
  const p = String(pointer || "").trim();
  if (!p) return "";
  return p.startsWith("/") ? p : `/${p}`;
}

function shouldValidateBehaviorLayer(dataString: string) {
  const text = String(dataString || "");
  return text.includes("behavior_layer_version") || text.includes("\"action_types\"") || text.includes("\"rules\"");
}

function tryParseJsonString(value: string) {
  try {
    return { ok: true as const, value: JSON.parse(value) };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "JSON parse error" };
  }
}

function buildAjv() {
  // Schema 由 scripts/inline-osi-samples.mjs 在构建期以 TS 字符串字面量形式
  // 内联到 server bundle，Vercel Serverless 运行时无需读取文件系统。
  const osiSchema = JSON.parse(OSI_SCHEMA_TEXT);
  const behaviorSchema = JSON.parse(BEHAVIOR_SCHEMA_TEXT);
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(behaviorSchema);
  const validateOsi = ajv.compile(osiSchema);
  const validateBehavior = ajv.getSchema(behaviorSchema.$id) || ajv.compile(behaviorSchema);
  return { validateOsi, validateBehavior };
}

export async function validateAndParseOsiFiles(files: OsiFileInput[]) {
  const errors: OsiImportError[] = [];
  const parsedDocs: Array<{ fileName: string; doc: OsiCoreDocument }> = [];

  const { validateOsi, validateBehavior } = buildAjv();

  for (const file of files) {
    const fileName = String(file?.name || "").trim() || "unknown.yaml";
    const yamlText = String(file?.yamlText || "");
    if (!yamlText.trim()) {
      errors.push(toError(fileName, "文件内容为空"));
      continue;
    }

    let doc: any = null;
    try {
      doc = loadYaml(yamlText);
    } catch (e: any) {
      errors.push(toError(fileName, `YAML 解析失败：${e?.message || "unknown error"}`));
      continue;
    }

    if (!doc || typeof doc !== "object") {
      errors.push(toError(fileName, "YAML 顶层必须是对象"));
      continue;
    }

    const ok = validateOsi(doc);
    if (!ok) {
      for (const err of validateOsi.errors || []) {
        const pointer = normalizeAjvPointer(err.instancePath);
        const msg = err.message || "schema validation error";
        errors.push(toError(fileName, msg, pointer));
      }
      continue;
    }

    const typed = doc as OsiCoreDocument;

    for (let smi = 0; smi < (typed.semantic_model || []).length; smi += 1) {
      const sm = typed.semantic_model[smi];
      const datasets = Array.isArray(sm?.datasets) ? sm.datasets : [];
      for (let dsi = 0; dsi < datasets.length; dsi += 1) {
        const ds = datasets[dsi];
        const exts = Array.isArray(ds?.custom_extensions) ? ds.custom_extensions : [];
        for (let ei = 0; ei < exts.length; ei += 1) {
          const ext = exts[ei] as any;
          const dataString = String(ext?.data || "");
          if (!shouldValidateBehaviorLayer(dataString)) continue;
          const parsed = tryParseJsonString(dataString);
          if (!parsed.ok) {
            errors.push(
              toError(
                fileName,
                `behavior_layer custom_extensions.data 不是合法 JSON：${parsed.error}`,
                `/semantic_model/${smi}/datasets/${dsi}/custom_extensions/${ei}/data`
              )
            );
            continue;
          }
          const okExt = validateBehavior(parsed.value);
          if (!okExt) {
            for (const err of validateBehavior.errors || []) {
              const pointer = normalizeAjvPointer(err.instancePath);
              const msg = err.message || "behavior layer schema validation error";
              errors.push(
                toError(
                  fileName,
                  `behavior_layer 校验失败：${msg}`,
                  `/semantic_model/${smi}/datasets/${dsi}/custom_extensions/${ei}/data${pointer}`
                )
              );
            }
          }
        }
      }
    }

    parsedDocs.push({ fileName, doc: typed });
  }

  return { ok: errors.length === 0, errors, parsedDocs };
}
