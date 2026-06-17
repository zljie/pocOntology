import "server-only";

// 内联样例 YAML：源 yaml 在构建期由 scripts/inline-osi-samples.mjs 转成
// 字符串字面量（见 lib/osi/samples/{pp,food}.ts），保证 Vercel Serverless
// 运行时无需文件系统即可加载。route 端只需要从这个入口取。

import { PP_YAML } from "@/lib/osi/samples/pp";
import { FOOD_YAML } from "@/lib/osi/samples/food";
import { OSI_SCHEMA_TEXT } from "@/lib/osi/samples/osi-schema";
import { BEHAVIOR_SCHEMA_TEXT } from "@/lib/osi/samples/behavior-schema";

export type OsiSampleId = "pp" | "food";

export interface OsiSampleSource {
  id: OsiSampleId;
  fileName: string;
  yamlText: string;
}

export const OSI_SAMPLES: Record<OsiSampleId, OsiSampleSource> = {
  pp: {
    id: "pp",
    fileName: "pp_semantic_model_semantic_v3.yaml",
    yamlText: PP_YAML,
  },
  food: {
    id: "food",
    fileName: "food_semantic_model_semantic_v2.yaml",
    yamlText: FOOD_YAML,
  },
};

// 重新导出 schema 文本，方便验证层统一从这里取。
export { OSI_SCHEMA_TEXT, BEHAVIOR_SCHEMA_TEXT };
