# AI 咨询强化版：迭代任务计划（数据推演 + 执行方案）

> 目标版本：AI 咨询强化版本（v1）  
> 核心目标：用户输入需求后，系统结合 LLM + 本体模型 + 可落地数据集，完成**数据推演**与**可执行方案制定**，并提供“确认→模拟/执行”的闭环。  

---

## 1. 目标与边界

### 1.1 v1 目标（必须做到）

1) **数据推演（Grounded Reasoning）**  
基于“本体模型 + 数据集（JSON/CSV/SQLite）”回答与推导，并给出可复现的证据链（例如 SQL、过滤条件、命中记录摘要）。

2) **执行方案制定（Planner）**  
把用户输入转成结构化“执行计划”（Plan），包含：目标、前置条件、步骤、依赖、风险、回滚、产物（DDL/SQL/API/配置变更草案）。

3) **执行闭环（Preview → Confirm → Apply）**  
默认只做预览（dry-run），用户确认后才允许落地写入（包括：本体变更、Neo4j 写入、或对数据集的写入）。

### 1.2 v1 非目标（明确不做/后置）

- 不做通用的权限/多租户/审计全套（只做最小安全闸门与确认）
- 不做复杂的工作流引擎（先用“计划步骤 + 模拟执行/回放”替代）
- 不追求一次性支持所有数据源（优先 Vercel 友好的 JSON/CSV，SQLite 作为本地可选）

---

## 2. 关键产物（Definition of Done）

### 2.1 统一的“执行计划”数据结构（建议 v1）

Plan（示意字段）：

- `goal`: 用户目标
- `context`: 本体摘要/选中对象/业务域/数据集信息
- `assumptions`: 假设与缺口（需要用户确认的点）
- `steps[]`: 每一步包含
  - `type`: `"QUERY" | "DDL" | "MUTATION" | "API_CALL" | "ONTOLOGY_CHANGE"`
  - `description`
  - `executable`: SQL / GraphQL / JSON Patch / Neo4j Cypher（之一）
  - `expectedOutput`: 预期结果（结构化）
  - `risk` / `rollback`
- `artifacts[]`: 可导出的文件/片段（SQL、DDL、接口草案、数据字典等）
- `validation[]`: 验收/校验点（可自动检查或人工确认）

> 备注：v1 不要求“真正执行到外部生产系统”，但要求能**模拟/回放**，并产生可交付工程资产。

---

## 3. 数据集能力设计（本体模型的数据集）

### 3.1 推荐路线（Vercel 友好优先）

**优先级 1：本地 JSON 数据集（推荐 v1 默认）**

- 形态：`datasets/*.json`
- 优点：Serverless 友好、部署简单、可版本化、可快速 seed
- 能力：读取/筛选/聚合（v1 先做到“可复现查询 + 证据摘要”）

**优先级 2：CSV 数据集**

- 形态：`datasets/*.csv`
- 优点：易于从业务导出、易编辑
- 能力：CSV → 内存表 → 简易 SQL（可选：用 sqlite in-memory 或轻量解析）

**可选：SQLite（本地 dev 优先，Vercel 作为后置选项）**

- 形态：`datasets/*.sqlite`
- 优点：天然 SQL、可做复杂查询与索引
- 风险：Vercel Serverless 文件系统与写入限制，需谨慎设计（只读/构建时生成/Edge 不可用等）

### 3.2 抽象接口（建议）

在 `lib/datasets/` 引入 `DatasetProvider` 接口，屏蔽底层差异：

- `listDatasets()`
- `getSchema(datasetId)`
- `query(datasetId, querySpec)` → 返回 `rows + evidence`
- `mutate?(...)`（v1 可先不开放写入，仅生成“写入草案”）

---

## 4. 迭代节奏（建议按 3 个 Sprint 切）

> 默认 1 个 Sprint = 1~2 周；如果你希望更快，也可以把 Sprint1+2 合并成 1 周冲刺版。

### Sprint 1：数据底座 + 证据链（Grounding Foundation）

**交付物**
- 数据集 Provider v1（至少 JSON；最好再带 CSV）
- “查询证据链”规范（返回结构：命中记录摘要 + 条件 + 统计）
- 最小 UI/接口：能选择数据集并跑一次 Query（可先在咨询模式里用工具按钮/命令）

**验收**
- 给定一个 JSON 数据集与本体映射说明，系统能输出可复现的查询条件与命中摘要
- 查询结果可被用于后续 Planner 作为上下文（prompt context）

### Sprint 2：Planner（执行计划生成）

**交付物**
- `/api/consulting-chat`（或新建 `/api/consulting-exec-plan/stream`）生成 Plan JSON
- Plan 的“缺口提问”机制：当信息不足时，返回澄清问题而非瞎猜
- 计划展示 UI：步骤列表、风险/回滚、产物预览

**验收**
- 用户输入（目标 + 背景）→ 输出结构化 Plan（含至少 3 类步骤：QUERY / API_CALL / ONTOLOGY_CHANGE 中的任意两类）
- Plan 中每步都有可执行片段（SQL/GraphQL/JSON Patch 之一）或明确“不可执行原因”

### Sprint 3：Preview→Confirm→Apply（模拟/执行闭环）

**交付物**
- Preview：对 Plan 中可执行步骤进行模拟（例如 SQL 预览、GraphQL simulate、Neo4j dry-run）
- Confirm：用户勾选步骤、逐项确认
- Apply：只执行“允许的、可验证的”步骤；失败可回滚/提示

**验收**
- 任一 Plan 可进入“预览/模拟”并生成回执（receipt）
- 用户确认后，至少支持 1 种真实落地：
  - 本体变更写入 store（并可选写入 Neo4j）
  - 或生成可下载的工程资产包（SQL/DDL/接口草案）

---

## 5. 风险与控制点（v1 最小闸门）

- 强制“先预览后执行”：无确认不写入
- 不足信息必须“提问/标红缺口”，禁止自动假设关键字段
- 执行步骤白名单（v1 仅允许：本体变更写入 + Neo4j 写入 + GraphQL simulate + 导出文件）
- 每次执行生成 receipt（输入摘要、plan hash、执行结果、失败原因、可复现证据）

---

## 6. 下一步（你只需确认 2 个选择）

1) v1 数据集默认选型：**JSON（推荐）** / CSV / SQLite（本地优先）  
2) v1 执行范围：**仅模拟+导出（推荐）** / 允许写入 Neo4j / 允许写入数据集

