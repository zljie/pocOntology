// 该脚本仅用于本地把 OSIFile/*.yaml 转换为 TypeScript 字符串字面量，
// 以便 Next.js / Vercel 部署时无需读取文件系统即可加载样例。
// 运行：node scripts/inline-osi-samples.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targets = [
  {
    id: "pp",
    src: "OSIFile/pp_semantic_model_semantic_v3.yaml",
    out: "lib/osi/samples/pp.ts",
    exportName: "PP_YAML",
  },
  {
    id: "food",
    src: "OSIFile/food_semantic_model_semantic_v2.yaml",
    out: "lib/osi/samples/food.ts",
    exportName: "FOOD_YAML",
  },
];

for (const t of targets) {
  const absSrc = resolve(root, t.src);
  const absOut = resolve(root, t.out);
  const text = readFileSync(absSrc, "utf8");
  // 使用 \n 显式换行 + JSON.stringify 把任意字符安全转义
  const body = JSON.stringify(text);
  const banner =
    "// 此文件由 scripts/inline-osi-samples.mjs 自动生成。\n" +
    "// 源文件：" + t.src + "\n" +
    "// 不要手动编辑。\n\n";
  const out = banner + "export const " + t.exportName + " = " + body + ";\n";
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, out, "utf8");
  console.log("[inline-osi-samples] wrote", t.out, "(" + text.length + " chars)");
}
