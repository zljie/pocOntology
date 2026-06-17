# Vercel 部署备忘

> 记录本仓库在 Vercel（Serverless 运行时）上跑 Next.js 14 时遇到的"文件
> 读取"类问题，以及对应的"构建期内联"修法，避免后续再踩。

## 背景

Vercel 的 Serverless 运行时没有持久的本地文件系统——`process.cwd()` 指向
`/var/task/`，只有 Next.js 在 build 阶段纳入 server bundle 的代码/资产才
能访问。仓库根下的 `OSIFile/**/*.yaml`、`OSIFile/spec/*.json`、
`datasets/*.json` 等**不会被**默认打包进 server bundle，因此在 route 中
直接 `fs.readFile(path.join(process.cwd(), "OSIFile/..."))` 在 Vercel 上
**必然失败**（返回空串或抛 ENOENT）。

更隐蔽的是：这个失败可能在本地测试中看不出来，因为本地 `process.cwd()`
就是仓库根，文件就在那；只有部署到 Vercel 后才暴露。

## 现象（历史踩坑）

- `POST /api/osi/import-sample` 报 `"error": "样例文件为空或不存在"`。
- 同样用 `fs.readFile` 的 `lib/osi/osi-validate.ts` 在导入流程里读
  `OSIFile/spec/osi-schema.json` + `behavior-layer.schema.json`，**Vercel
  上读不到**——表现是 400 `"OSI 校验失败"`，但 errors 列表是空（实际上
  是 AJV 根本没能 compile schema）。
- `lib/datasets/json-entities-provider.ts` 用 `fs.readFile` 读
  `datasets/manifest.json` + `datasets/erp-demo.json`，Vercel 上同样会
  失败。

## 修法：构建期内联（Build-time Inline）

新增 `scripts/inline-osi-samples.mjs` 与 `scripts/inline-datasets.mjs`：

1. 在构建前/构建时把 YAML / JSON 资产读出来，用 `JSON.stringify` 包成
   TypeScript 字符串字面量，写成 `lib/osi/samples/{pp,food}.ts`、
   `lib/osi/samples/osi-schema.ts`、
   `lib/osi/samples/behavior-schema.ts`、
   `lib/datasets/inline/{manifest,erp-demo}.ts`。
2. 业务代码用 `import { X } from "@/lib/.../inline/..."` 静态导入。
3. 删掉所有 `fs.readFile` 路径。

这样资产就是普通的 TS 常量，会被 webpack/turbopack 打进 server bundle，
Vercel Serverless 直接读内存即可。

## 复现脚本

`scripts/repro-import-sample.mjs` 用纯 inlined 资产模拟 Vercel 的执行路径
（不读 `OSIFile/spec/*.json`），用于在本地验证"线上一定能跑通"。

```bash
node scripts/repro-import-sample.mjs
```

预期输出末尾：`[结论] ✓ 全部通过，Vercel 上不会再报 400 'OSI 校验失败'`。

## 注意事项

- 内联生成的 `.ts` 顶部带 banner `// 此文件由 xxx 自动生成`，请勿手编。
- 修改源 yaml/json 后要重新跑 inline 脚本（最好接到 prebuild hook 或
  CI 步骤里），否则部署的还是旧内容。
- 当前 `lib/datasets/json-entities-provider.ts` 通过 `SOURCES[item.file]`
  按文件名取内存对象——以后新增数据集时，记得同步更新 `SOURCES` 的 key
  或者改成统一按 `id` 取。
- `tsconfig.tsbuildinfo` 已加入 `.gitignore`，避免被误提交。
