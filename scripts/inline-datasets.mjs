// 与 inline-osi-samples.mjs 同样的方式：把 datasets/*.json 转为 TypeScript
// 字符串字面量，让 Next.js / Vercel Serverless 部署时无需文件系统即可加载。
// 运行：node scripts/inline-datasets.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targets = [
  {
    src: "datasets/manifest.json",
    out: "lib/datasets/inline/manifest.ts",
    exportName: "MANIFEST_TEXT",
  },
  {
    src: "datasets/erp-demo.json",
    out: "lib/datasets/inline/erp-demo.ts",
    exportName: "ERP_DEMO_TEXT",
  },
];

for (const t of targets) {
  const absSrc = resolve(root, t.src);
  const absOut = resolve(root, t.out);
  const text = readFileSync(absSrc, "utf8");
  const body = JSON.stringify(text);
  const banner =
    "// 此文件由 scripts/inline-datasets.mjs 自动生成。\n" +
    "// 源文件：" + t.src + "\n" +
    "// 不要手动编辑。\n\n";
  const out = banner + "export const " + t.exportName + " = " + body + ";\n";
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, out, "utf8");
  console.log("[inline-datasets] wrote", t.out, "(" + text.length + " chars)");
}
