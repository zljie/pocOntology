import "server-only";

// 重新导出 schema 字符串文本，作为 OSI 校验层的唯一入口。
// 源 JSON 由 scripts/inline-osi-samples.mjs 在构建期内联到 server bundle。

export { OSI_SCHEMA_TEXT, BEHAVIOR_SCHEMA_TEXT } from "@/lib/osi/samples";
