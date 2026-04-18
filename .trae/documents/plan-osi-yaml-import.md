# OSI YAML 本体导入与展示（food + pp v2）— 实施计划

## 1. Summary（目标与交付）

把你提供的两份 OSI v0.1.1 YAML 语义模型：
- `OSIFile/food_semantic_model_semantic_v2.yaml`
- `OSIFile/pp_semantic_model_semantic_v2.yaml`

在本项目中实现“严格校验 → 导入 → 画布展示”的闭环：
- **严格校验**：按 [osi-schema.json](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/spec/osi-schema.json) 校验 OSI Core；按 [behavior-layer.schema.json](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/spec/behavior-layer.schema.json) 校验 behavior layer（若存在）。
- **整包替换导入**：导入结果覆盖当前画布本体数据（objectTypes/linkTypes/actionTypes/...）。
- **展示**：导入后直接在中心画布看到对象（datasets）与关系（relationships）。
- **Neo4j 同步**：若已选择 `neo4jProject`，导入成功后调用 `upsert-meta(reset=true)` 重置并写入该项目库，使 Neo4j 与画布保持一致。

## 2. Current State Analysis（现状盘点）

### 2.1 现有导入能力
- JSON 数组 → 推断列 → 生成单个 ObjectType：[import-dialog.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/proposal-system/import-dialog.tsx)
- MetaCore JSON 整包导入/导出（replaceAll）：[meta-toolbox-sheet.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/meta/meta-toolbox-sheet.tsx)
- 当前仓库**没有** YAML 解析与 OSI schema 校验的导入链路（但 `package-lock.json` 中存在 transitive 的 `js-yaml`）。

### 2.2 画布渲染链路
- `objectTypes`→节点，`linkTypes`→边：[ontology-canvas.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/graph-canvas/ontology-canvas.tsx)
- 导入后只要写入 store（replaceAll），画布即可展示，无需额外渲染改造。

### 2.3 OSI 规格与示例文件特征
- OSI Core：`semantic_model[].datasets/relationships/fields/metrics` 等（schema：[osi-schema.json](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/spec/osi-schema.json)）
- behavior layer：以 `dataset.custom_extensions[].data` 的 JSON 字符串形式嵌入（规范：[behavior-layer.md](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/spec/behavior-layer.md)，schema：[behavior-layer.schema.json](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/spec/behavior-layer.schema.json)）

## 3. Decisions（已确认的关键决策）

- 导入策略：**整包替换**
- 映射范围：**datasets + relationships** 映射到画布（ObjectType + LinkType）
- 展示方式：**导入后直接上画布**
- 校验：**严格校验**（不通过则拒绝导入，并输出错误清单）
- Neo4j：若存在 `neo4jProject`，则**写入并 reset**

## 4. Proposed Changes（改动方案）

### 4.1 新增：OSI YAML → MetaCore 转换与校验（服务端）

新增模块（建议）：
- `lib/osi/osi-validate.ts`（server-only）
  - 使用 `js-yaml` 解析 YAML → JS object
  - 使用 `ajv`（v8）加载并校验：
    - OSI Core：`OSIFile/spec/osi-schema.json`
    - behavior layer：`OSIFile/spec/behavior-layer.schema.json`（当 custom_extensions.data 解析为 JSON 且包含 `behavior_layer_version` 等字段时必须通过）
  - 产出结构化错误清单（文件名/路径/json-pointer/message）

- `lib/osi/osi-to-metacore.ts`（server-only）
  - 输入：多个 OSI 文档（每个 YAML 可能包含多个 `semantic_model`）
  - 输出：`MetaCore`（仅填充 `objectTypes` / `linkTypes`；其它数组置空），以及导入统计（对象数/关系数/字段数）
  - ID 策略：用 `stableHash` 生成稳定 ID，便于重复导入的 diff/可追溯
    - ObjectType.id：`osi-ot-${stableHash("dataset:"+dataset.name)}`
    - Property.id：`osi-prop-${stableHash(dataset.name+":"+field.name)}`
    - LinkType.id：`osi-link-${stableHash("rel:"+relationship.name)}`
  - 命名映射（严格）
    - dataset.name → ObjectType.apiName（PascalCase），冲突则报错
    - field.name → Property.apiName（camelCase），冲突则报错
  - 字段类型映射（严格但可落地）
    - `dimension.is_time=true` → `TIMESTAMP`
    - 其它字段默认 `STRING`（OSI Core 未提供类型字段，不做猜测）
  - 主键映射
    - OSI `primary_key` 支持复合键，但本项目 `ObjectType.primaryKey` 仅支持单 Property ID：取 `primary_key[0]` 作为 primaryKey（若为空则留空）
    - `titleKey`：优先匹配 `name/title/display_name`（camelCase 后）字段，否则回退 primaryKey 或第一个属性
  - 关系映射
    - OSI relationship 语义：`from` 为 many side、`to` 为 one side → `cardinality = "MANY_TO_ONE"`
    - `foreignKeyPropertyId`：尽量根据 `from_columns[0]` 匹配到 source ObjectType 的 Property（匹配不到留空）

新增 API（建议）：
- `app/api/osi/import/route.ts`
  - `POST` 入参：`{ files: [{ name: string, yamlText: string }] }`
  - 流程：解析→严格校验→转换→返回 `{ meta, report }` 或 `{ errors }`
  - 仅 Node runtime

依赖变更（需要落入 package.json）：
- 增加直接依赖：`js-yaml`（避免依赖 transitive）
- 增加校验依赖：`ajv`（v8）+ `ajv-formats`（如需格式校验）

### 4.2 新增：OSI 导入对话框（前端）

新增组件（建议）：
- `components/osi-import/osi-import-dialog.tsx`
  - 支持多文件上传（至少两个 YAML）
  - 导入按钮点击后调用 `/api/osi/import`：
    - 若返回 errors：以列表展示（严格模式下阻塞导入）
    - 若成功：调用 `useOntologyStore().replaceAll(meta)` 实现整包替换，并清理 selection/proposals
  - 若 `neo4jProject` 存在：导入成功后调用 `upsertMetaToNeo4jClient({ reset: true, meta })`
  - 导入完成后：自动关闭对话框，画布立即展示导入结果

UI 挂载与入口：
- `stores/ui-store.ts`：新增 `showOsiImportDialog` + `setShowOsiImportDialog`
- `app/page.tsx`：挂载 `<OsiImportDialog open=... />`
- `components/layout/header.tsx`：新增入口按钮/菜单项（与现有 ImportDialog 并列）

### 4.3 兼容与约束处理（严格校验下的必要策略）

- dataset.name / relationship.name / field.name 重名或映射后 apiName 冲突：直接报错并拒绝导入（严格模式）
- behavior-layer：
  - `custom_extensions.data` 若包含 behavior layer 关键字段但不是合法 JSON / 不符合 schema：报错拒绝导入
  - 本迭代不映射 action_types/rules 到 MetaCore（按决策），但会做严格校验，确保模型自洽

## 5. Tasks Breakdown（执行步骤）

1) 增加依赖：`js-yaml`、`ajv`、`ajv-formats`
2) 实现 OSI 校验模块（OSI Core + behavior layer）
3) 实现 OSI → MetaCore 转换模块（datasets/relationships/fields）
4) 新增 `/api/osi/import`（解析/校验/转换/回报 errors）
5) 新增 OSI 导入对话框（上传→调用 API→replaceAll→上画布）
6) 若存在 `neo4jProject`：导入后 `upsert-meta(reset=true)` 写入 Neo4j
7) 将该需求以新卡片加入 `plan.md`（Backlog→In Progress），并在验收后移动到 Done

## 6. Verification（验证方式）

功能验收路径：
1) 打开 OSI 导入对话框，分别上传 food/pp 两个 YAML
2) 触发严格校验：
  - 任一文件 schema 不通过 → 展示错误清单，禁止导入
3) 校验通过后导入：
  - 画布出现 datasets 对应的 ObjectType 节点
  - relationships 出现在画布为连线（cardinality MANY_TO_ONE）
4) 若当前存在 `neo4jProject`：
  - 导入后写入 Neo4j（reset=true）成功返回

工程验证：
- `npm run lint`
- `npm run build`

