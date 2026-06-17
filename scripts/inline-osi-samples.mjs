// 把以下资产转为 TypeScript 字符串字面量，便于 Next.js / Vercel Serverless
// 部署时无需读取文件系统即可加载。
//   - lib/osi/samples/pp.ts        (PP 样例 YAML)
//   - lib/osi/samples/food.ts      (food 样例 YAML)
//   - lib/osi/samples/schemas.ts   (OSI 校验用的两份 JSON Schema)
//
// 运行：node scripts/inline-osi-samples.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targets = [
  {
    src: "OSIFile/pp_semantic_model_semantic_v3.yaml",
    out: "lib/osi/samples/pp.ts",
    exportName: "PP_YAML",
    note: "PP 样例 YAML",
  },
  {
    src: "OSIFile/food_semantic_model_semantic_v2.yaml",
    out: "lib/osi/samples/food.ts",
    exportName: "FOOD_YAML",
    note: "food 样例 YAML",
  },
  {
    src: "OSIFile/spec/osi-schema.json",
    out: "lib/osi/samples/osi-schema.ts",
    exportName: "OSI_SCHEMA_TEXT",
    note: "OSI 核心 JSON Schema",
  },
  {
    src: "OSIFile/spec/behavior-layer.schema.json",
    out: "lib/osi/samples/behavior-schema.ts",
    exportName: "BEHAVIOR_SCHEMA_TEXT",
    note: "OSI 动势层 JSON Schema",
  },
];

for (const t of targets) {
  const absSrc = resolve(root, t.src);
  const absOut = resolve(root, t.out);
  const text = readFileSync(absSrc, "utf8");
  const body = JSON.stringify(text);
  const banner =
    "// 此文件由 scripts/inline-osi-samples.mjs 自动生成。\n" +
    "// 源文件：" + t.src + " (" + t.note + ")\n" +
    "// 不要手动编辑。\n\n";
  const out = banner + "export const " + t.exportName + " = " + body + ";\n";
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, out, "utf8");
  console.log("[inline-osi-samples] wrote", t.out, "(" + text.length + " chars)");
}
