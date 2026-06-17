# 架构清单（Architecture Checklist）

> 面向：本仓库（Ontology Design Simulator）  
> 目标：快速对齐「系统由哪些层/模块/依赖组成」「关键数据如何流转」「外部依赖与部署边界是什么」  

---

## 0. 项目定位（What / Why）

- 产品形态：可视化本体（Ontology）建模与语义查询联动的 Next.js Web 应用
- 核心能力：
  - 三层本体：语义层（实体/关系）+ 动势层（动作/数据流）+ 动态层（规则/模型/洞察）
  - 可视化图谱画布：对象节点/关系连线的交互建模与联动查看
  - 语义查询：自然语言 → 结构化意图/字段/多协议预览（RDF/OWL/SWRL/DSL/GraphQL/SQL 等）
  - OSI YAML 导入：按 schema 校验后导入并展示
  - Neo4j 持久化：创建项目库、写入/重置、seed

---

## 1. 技术栈（确认项）

### 1.1 前端

- [x] Next.js 14（App Router，`app/`）
- [x] React 18 + TypeScript
- [x] Tailwind CSS（`tailwind.config.ts` + `globals.css`）
- [x] Radix UI（`@radix-ui/*`，组件位于 `components/ui/`）
- [x] Zustand（`stores/`，含 `persist`）
- [x] 图谱/交互：D3.js（`d3`）
- [x] 文档/渲染：Streamdown（`streamdown` + `@streamdown/*`）

### 1.2 服务端（同仓 Next.js Route Handlers）

- [x] Next.js API Route Handlers：`app/api/**/route.ts`
- [x] Neo4j Driver：`neo4j-driver`
- [x] Schema 校验：AJV（`ajv` + `ajv-formats`）
- [x] YAML 解析：`js-yaml`

---

## 2. 代码与目录结构（Where）

> 只列关键职责目录，便于“从目录到能力”的快速映射。

- `app/`
  - `app/page.tsx`：应用主入口（工作模式切换、三栏布局组装、弹窗挂载）
  - `app/api/`：后端能力（LLM/Neo4j/导入/模拟等）
- `components/`
  - `layout/`：Header、三栏布局框架
  - `graph-canvas/`：画布与图谱渲染（节点/边/工具栏）
  - `ontology-layers/`：三层本体左侧面板（实体/关系/动作/规则等）
  - `property-editor/`：右侧属性编辑器（语义/动势/动态）
  - `semantic-query/`：右侧语义查询面板 + 预览
  - `osi-import/`：OSI YAML 导入对话框（含启动导入）
  - `project-onboarding/`：新建项目引导画布/面板
  - `consulting/`：咨询模式（左右面板、咨询对话、变更确认等）
  - `proposal-system/`：导入/提案相关 UI
  - `ui/`：基础 UI 组件（Radix 封装）
- `lib/`
  - `lib/types/`：核心类型定义（本体/样例）
  - `lib/meta/`：MetaCore 质量闸门、diff/hash 等
  - `lib/neo4j/`：Neo4j driver/client/writer
  - `lib/osi/`：OSI 导入与校验、转换到 MetaCore
  - `lib/orm/`：ORM 映射与 DDL/SQL 生成
  - `lib/semantic/`：GraphQL/SQL 生成辅助
- `stores/`：Zustand 状态（本体、咨询、引导、选择、UI 等）
- `OSIFile/`：OSI spec/schema + 样例 yaml

---

## 3. 核心数据模型（What）

### 3.1 MetaCore（统一语义内核）

- 入口定义：`lib/meta/meta-core.ts`
- 聚合结构：`MetaCore = { objectTypes, linkTypes, actionTypes, dataFlows, businessRules, aiModels, analysisInsights }`
- 质量闸门：`validateMetaCore(meta)`（命名规范、重复、引用完整性、基数/类型合法性等）

### 3.2 三层本体类型（Semantic / Kinetic / Dynamic）

- 类型定义：`lib/types/ontology.ts`
- 语义层（SEMANTIC）
  - `ObjectType`：实体类型（properties、主键/标题键、layer 等）
  - `LinkType`：关系类型（source/target、cardinality、关系属性等）
- 动势层（KINETIC）
  - `ActionType`：动作类型（输入/输出参数、影响对象、可选 GraphQL 映射、API 绑定）
  - `DataFlow`：数据流（流程编排/依赖）
- 动态层（DYNAMIC）
  - `BusinessRule` / `AIModel` / `AnalysisInsight`：规则、模型、洞察等

---

## 4. 前端架构（How - UI/State）

### 4.1 页面骨架与工作模式

- 主页面：`app/page.tsx`
- 布局：`components/layout/three-panel-layout.tsx`
- 工作模式（示例）：`workMode === "CONSULTING"` 时切换左右面板与右侧内容，并控制底部预览显隐

### 4.2 状态管理（Zustand）

- 本体状态：`stores/ontology-store.ts`
  - 本体元素 CRUD（对象/关系/动作/规则/洞察…）
  - ORM Mapping 派生/重置
  - Neo4j 项目选择信息 `neo4jProject`
- 其它状态：`stores/*`（UI、咨询、引导、选择等）
- [ ]（待确认）持久化落点：`persist` 默认使用 localStorage（浏览器端）；若有多项目隔离策略需补充说明

---

## 5. 后端 API（Next.js Route Handlers）清单（What / Where）

> 路径按仓库现状枚举，便于对齐“UI 调用→后端能力→外部依赖”。

### 5.1 LLM/生成与语义推演

- `POST /api/object-type-gen/stream`
- `POST /api/link-type-gen/stream`
- `POST /api/action-type-gen/stream`
- `POST /api/project-scope-gen/stream`
- `POST /api/semantic-query`
- `POST /api/semantic-query/stream`
- `POST /api/consulting-chat`
- `POST /api/consulting-chat/stream`
- `POST /api/orm-chat`
- `POST /api/business-scenario-sandbox`
- `POST /api/semantic-query-predict-resources`

### 5.2 OSI 导入

- `POST /api/osi/import`
- `POST /api/osi/import-sample`

### 5.3 Neo4j（项目化与持久化）

- `POST /api/neo4j/create-database`
- `POST /api/neo4j/upsert-meta`
- `POST /api/neo4j/seed`
- `GET/POST /api/neo4j/onboarding-state`（以实际实现为准）

### 5.4 其它

- `POST /api/simulate-graphql`

---

## 6. 外部依赖与环境变量（Boundary）

### 6.1 LLM（MiniMax Anthropic-compatible）

从 `process.env.*` 使用情况可见（多处 route.ts）：

- `MINIMAX_API_KEY`（或回退 `ANTHROPIC_API_KEY`）
- `MINIMAX_ANTHROPIC_BASE_URL`（默认 `https://api.minimaxi.com/anthropic`）
- `MINIMAX_MODEL`（默认 `MiniMax-M2.7`；`.env.example` 为 `MiniMax-M2.1-highspeed`）

### 6.2 Neo4j

来自 `lib/neo4j/driver.ts`：

- `NEO4J_URI`（必填）
- `NEO4J_PASSWORD`（必填）
- `NEO4J_USERNAME`（可选，默认 `neo4j`）
- `NEO4J_DATABASE`（可选）

> 注意：当前 `.env.example` 未包含 Neo4j 变量；建议补齐，以减少“环境缺省”导致的启动失败。

---

## 7. 关键链路（Dataflow / Workflow）

### 7.1 本体建模（UI → Store）

- 用户在画布/左侧面板创建 ObjectType/LinkType/ActionType…
- 写入 `useOntologyStore`，并驱动：
  - 中心画布渲染（节点/边）
  - 右侧属性编辑器展示与编辑

### 7.2 导入（OSI YAML → 校验 → MetaCore → UI/Neo4j）

- OSI 文件解析（YAML/JSON schema）
- 转换到 MetaCore（ObjectType/LinkType/…）
- 替换 store（整包替换策略）
- 若选择 Neo4j 项目：调用 `/api/neo4j/*` 写入并 reset

### 7.3 语义查询（NL → 结构化 → 多协议预览）

- 右侧语义查询面板发起请求到 `/api/semantic-query(/stream)`
- 返回结构化结果并渲染到底部多 Tab 预览（GraphQL/SQL/DSL…）

---

## 8. 部署与运行（Run / Build / Ship）

- npm scripts（`package.json`）：
  - `npm run dev`：本地开发
  - `npm run build`：构建
  - `npm run start`：生产启动
  - `npm run lint`：代码规范
- [ ] CI/CD：仓库内未见明确配置（待补充，例如 GitHub Actions / Vercel 自动部署策略）
- [ ] 观测性：日志、错误上报、性能监控（待补充）
- [ ] 鉴权/权限：当前未看到登录/鉴权体系（待补充或确认“不在范围内”）

---

## 9. 快速复核（建议你按需勾选）

- [ ] 能本地启动（dev）并打开首页
- [ ] 不配置 Neo4j 时，核心建模/预览仍可用（或明确要求必须配置）
- [ ] OSI 导入：Food/PP 样例可成功导入并在画布可视化
- [ ] 语义查询：可得到稳定结构化结果与多协议预览
- [ ] Neo4j：创建项目库、upsert、seed、reset 链路可用

