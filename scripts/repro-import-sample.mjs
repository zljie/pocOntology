// 复现脚本：模拟 /api/osi/import-sample 在 Vercel 上的执行路径。
// 关键：不读取 OSIFile/spec/*.json（Vercel 上读不到），只从 inlined 字符串取。
// 如果这个脚本能跑通，那么线上也一定能跑通。
//
// 运行：node scripts/repro-import-sample.mjs
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readInlinedStringLiteral(p) {
  const text = readFileSync(p, "utf8");
  const m = text.match(/= ("(?:\\.|[^"\\])*")\s*;?\s*$/s);
  if (!m) throw new Error(`无法从 ${p} 解析字符串字面量`);
  return JSON.parse(m[1]);
}

const sampleIds = ["pp", "food"];

console.log("[Vercel 模拟] 严格只走 inlined 资产，零 fs 读 spec");
const osiSchema = JSON.parse(readInlinedStringLiteral(resolve(root, "lib/osi/samples/osi-schema.ts")));
const behaviorSchema = JSON.parse(readInlinedStringLiteral(resolve(root, "lib/osi/samples/behavior-schema.ts")));
console.log("  - inlined OSI schema 顶层 keys:", Object.keys(osiSchema).join(", "));
console.log("  - inlined behavior schema 顶层 keys:", Object.keys(behaviorSchema).join(", "));

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(behaviorSchema);
const validateOsi = ajv.compile(osiSchema);
const validateBehavior = ajv.getSchema(behaviorSchema.$id) || ajv.compile(behaviorSchema);

let allPass = true;
for (const id of sampleIds) {
  console.log(`\n[sample=${id}]`);
  const yamlText = readInlinedStringLiteral(resolve(root, `lib/osi/samples/${id}.ts`));
  console.log(`  - yaml 长度: ${yamlText.length} 字符`);

  let doc;
  try {
    doc = loadYaml(yamlText);
  } catch (e) {
    console.error("  ! YAML 解析失败:", e.message);
    allPass = false;
    continue;
  }
  console.log("  - 顶层 keys:", Object.keys(doc || {}).join(", "));

  const ok = validateOsi(doc);
  if (!ok) {
    console.error(`  ! OSI 校验失败（${validateOsi.errors?.length || 0} 个错误）:`);
    for (const err of (validateOsi.errors || []).slice(0, 5)) {
      console.error("    -", err.instancePath || "/", err.message, JSON.stringify(err.params || {}).slice(0, 120));
    }
    allPass = false;
    continue;
  }
  console.log("  ✓ OSI 校验通过");

  let behCount = 0, behFail = 0;
  for (let smi = 0; smi < (doc.semantic_model || []).length; smi += 1) {
    const sm = doc.semantic_model[smi];
    for (let dsi = 0; dsi < (sm?.datasets || []).length; dsi += 1) {
      const ds = sm.datasets[dsi];
      for (let ei = 0; ei < (ds?.custom_extensions || []).length; ei += 1) {
        const ext = ds.custom_extensions[ei];
        const data = String(ext?.data || "");
        if (!(data.includes("behavior_layer_version") || data.includes('"action_types"') || data.includes('"rules"'))) continue;
        behCount += 1;
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) {
          behFail += 1;
          console.error(`  ! behavior JSON parse 失败 sm=${smi} ds=${dsi} ext=${ei}:`, e.message);
          continue;
        }
        const ok2 = validateBehavior(parsed);
        if (!ok2) {
          behFail += 1;
          console.error(`  ! behavior 校验失败 sm=${smi} ds=${dsi} ext=${ei}:`);
          for (const err of (validateBehavior.errors || []).slice(0, 5)) {
            console.error("    -", err.instancePath || "/", err.message, JSON.stringify(err.params || {}).slice(0, 120));
          }
        }
      }
    }
  }
  console.log(`  - behavior 块: ${behCount} 个, 失败 ${behFail} 个`);
  if (behFail > 0) allPass = false;
}

console.log("\n[结论]", allPass ? "✓ 全部通过，Vercel 上不会再报 400 'OSI 校验失败'" : "✗ 仍有失败，请看上面 ! 行");
process.exit(allPass ? 0 : 1);
