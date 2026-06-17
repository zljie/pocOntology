# [0043] 新建项目引导画布：渐进式节点生成（业务范围→对象→场景→行为/事件）— 实施计划

## 1. Summary（目标与交付）

在用户“新建项目（Neo4j 数据库）”成功后，自动进入一个**引导画布**：中心画布展示 4 个固定的“引导节点卡片”，按顺序推进并通过 AI 生成 + 勾选确认，把业务信息逐步沉淀为可用的本体资产（ObjectType / ActionType 等）。引导状态与中间产物需要**按项目隔离**，并且**同步写入 Neo4j**，以便刷新或换端也可恢复进度。

本计划覆盖：
- 引导画布 UI 形态与交互（4 节点 + 锁定/解锁 + 回退）
- 每个节点的 AI 生成与“确认落地”
- 引导进度的本地持久化 + Neo4j 持久化（读/写 API）
- 新建项目流程接入（自动进入引导）

不包含（本迭代不做）：
- 多人协作/多用户权限
- 引导产物的高级质量闸门（只复用现有命名规范与去重能力）
- 复杂的“场景→数据流/规则”自动生成（后续可在 [0042] 或其他卡片扩展）

## 2. Current State Analysis（基线现状）

### 2.1 新建项目入口与状态
- “新建本体画布（Neo4j 项目）”在 [header.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/layout/header.tsx#L85-L124)：
  - 调用 `createNeo4jDatabaseClient(dbName)` 创建数据库
  - 成功后 `clearOntology/clearSelection/clearProposals`，并 `setNeo4jProject({ dbName, displayName })`
- Neo4j 创建 API 在 [create-database/route.ts](file:///Users/johnson_mac/code/ontology-simulator/app/api/neo4j/create-database/route.ts#L11-L36)（system 库执行 `CREATE DATABASE`）
- 当前项目标识存于 `useOntologyStore().neo4jProject`（Zustand persist）[ontology-store.ts](file:///Users/johnson_mac/code/ontology-simulator/stores/ontology-store.ts#L61-L126)

### 2.2 画布结构与右侧面板
- 页面布局在 [page.tsx](file:///Users/johnson_mac/code/ontology-simulator/app/page.tsx#L27-L48)：`ThreePanelLayout`，中心为 `OntologyCanvas`，右侧面板按工作模式渲染
- `OntologyCanvas` 当前主要渲染本体节点/关系（ReactFlow 或知识图谱视图）[ontology-canvas.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/graph-canvas/ontology-canvas.tsx#L268-L299)
- 右侧面板“可扩展”模式：`rightPanel` 传入多个组件，组件自行 return null（已有约定）

### 2.3 AI 生成的既有模式（可复用）
- 对象类型 AI：UI 在 [entity-type-ai-assistant-drawer.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/ontology-layers/entity-type-ai-assistant-drawer.tsx)，SSE API 在 [object-type-gen/stream/route.ts](file:///Users/johnson_mac/code/ontology-simulator/app/api/object-type-gen/stream/route.ts)
- 动作类型 AI：UI 在 [action-type-ai-assistant-drawer.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/ontology-layers/action-type-ai-assistant-drawer.tsx)，SSE API 在 [action-type-gen/stream/route.ts](file:///Users/johnson_mac/code/ontology-simulator/app/api/action-type-gen/stream/route.ts)
- 业务场景沙盘：UI 在 [business-scenario-sandbox.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/scenario-sandbox/business-scenario-sandbox.tsx)，API 在 [business-scenario-sandbox/route.ts](file:///Users/johnson_mac/code/ontology-simulator/app/api/business-scenario-sandbox/route.ts)

## 3. Decisions（已确认的关键决策）

来自本次对齐：
- 触发方式：新建项目成功后**自动进入**引导画布
- 生成方式：每个节点主要依赖 **AI（LLM）生成**结构化建议，再“确认落地”
- 持久化：引导进度与中间产物**同时写入 Neo4j**（随项目持久化）
- 画布形态：中心画布展示 4 个固定的**节点卡片**

## 4. Proposed Changes（改动方案与拆解）

### 4.1 新增：Project Onboarding 数据模型（前端）

新增类型（建议路径）：
- `lib/types/project-onboarding.ts`：
  - `OnboardingStepId = "SCOPE" | "OBJECTS" | "SCENARIOS" | "ACTIONS"`
  - `OnboardingStepStatus = "LOCKED" | "READY" | "DONE"`
  - `OnboardingState`（按项目 dbName 隔离）：
    - `projectDbName`
    - `currentStep`
    - `steps`: 每步包含
      - `inputText`（用户输入）
      - `assistantMarkdown`（AI 输出的解释/追问）
      - `proposalJson`（结构化结果，用于确认落地）
      - `confirmedAt?`
      - `appliedMetaIds`（落地生成的 ObjectType/ActionType id 列表等）
    - `updatedAt`

落地策略：
- 引导状态应可“回退修改”并重算后续步：因此需要能清空某一步及其之后的状态。

### 4.2 新增：Project Onboarding Store（本地持久化 + 项目隔离）

新增 store（建议路径）：
- `stores/onboarding-store.ts`（Zustand + persist）：
  - 按 `neo4jProject.dbName` 保存 `onboardingByProject: Record<string, OnboardingState>`
  - Actions：
    - `initProjectOnboarding(dbName)`：创建默认 4 步状态（SCOPE READY，其余 LOCKED）
    - `setStepInput(dbName, stepId, text)`
    - `setStepProposal(dbName, stepId, assistantMarkdown, proposalJson)`
    - `confirmStep(dbName, stepId, appliedMetaIds)`：标记 DONE，并解锁下一步
    - `rollbackTo(dbName, stepId)`：将该步及后续步骤重置为 READY/LOCKED
    - `setCurrentStep(dbName, stepId)`
  - persist key：`ontology-onboarding-storage`

### 4.3 新增：Onboarding 画布（中心画布 4 个节点卡片）

新增组件（建议路径）：
- `components/project-onboarding/project-onboarding-canvas.tsx`
  - 用 ReactFlow 渲染 4 个固定节点（不依赖 objectTypes/linkTypes）
  - 节点样式：显示标题、状态（LOCKED/READY/DONE）、简短描述、进度提示
  - 交互：点击节点 → `setCurrentStep` 并 `openRightPanel()`
  - 锁定策略：LOCKED 点击仅提示“请先完成上一步”

集成点：
- 在 `OntologyCanvas` 内根据 `uiStore.projectOnboardingMode` 切换渲染：
  - onboardingMode=true：渲染 `ProjectOnboardingCanvas`
  - 否则：渲染现有的本体画布

### 4.4 新增：Onboarding 右侧面板（每步 Input→Generate→Confirm→Apply）

新增右侧面板组件（建议路径）：
- `components/project-onboarding/project-onboarding-right-panel.tsx`
  - 根据 `currentStep` 渲染 4 个 Step Panel（每个 panel 自行 return null，符合现有 rightPanel 扩展模式）
  - 每个 Step Panel 的交互三段式：
    - 输入区：textarea/输入示例
    - 生成区：展示 assistantMarkdown + proposalJson 预览
    - 确认落地：checkbox 列表 + “确认并创建/应用”

4 个节点建议的生成与落地逻辑（复用现有能力优先）：
- Step1 业务范围（SCOPE）
  - 新增 SSE API：`/api/project-scope-gen/stream`
  - proposalJson（示例 schema）：
    - `scopeSummary`（一句话）
    - `inScope[] / outOfScope[]`
    - `coreDomains[]`（可选）
    - `glossary[]`（关键名词）
    - `openQuestions[]`
  - 落地：
    - 先写入 onboarding state（Neo4j + 本地）
    - 可选：同步写入一个轻量 `MetaSnapshot` 备注（若需要在本体侧可见；默认不强耦合）
- Step2 业务对象（OBJECTS）
  - 复用 `/api/object-type-gen/stream` 的 step2/3 逻辑
  - proposalJson：objectTypes 计划（与现有确认创建一致）
  - 落地：调用 `addObjectType` 批量创建，并记录 created ids；如存在 `neo4jProject`，复用 `upsertMetaToNeo4jClient` 增量写入（与现有 AI drawer 一致）
- Step3 业务场景（SCENARIOS）
  - 复用 `/api/business-scenario-sandbox` 生成场景金字塔（以当前本体快照为输入）
  - proposalJson：`pyramid.groups[].scenarios[]`
  - 确认落地：允许用户勾选“保留的关键场景”（例如 5–20 条），写入 onboarding state；并解锁下一步
- Step4 业务行为/事件（ACTIONS）
  - 复用 `/api/action-type-gen/stream` 的 step2/3 逻辑（输入可带上已选场景摘要 + 对象摘要）
  - proposalJson：actionTypes 计划
  - 落地：批量 `addActionType`，记录 created ids；增量写入 Neo4j

完成条件：
- Step4 confirm 后自动退出 onboardingMode，回到正常本体画布（保留右侧面板可继续编辑）

### 4.5 新增：Neo4j 持久化（读/写 onboarding state）

新增 API（建议路径）：
- `app/api/neo4j/onboarding-state/route.ts`
  - `GET`：入参 `database`（项目 dbName），返回该项目的 onboarding `stateJson`
  - `POST`：写入 onboarding `stateJson`

Neo4j 存储模型（建议）：
- 单节点存储（每个项目数据库内一个节点）：
  - `(:ProjectOnboarding { id: "onboarding", updatedAt: "...", stateJson: "..." })`
  - 读写用 `MERGE` 保证幂等
  - `stateJson` 为 JSON 字符串（避免 Neo4j property 对嵌套对象的限制）

前端同步策略：
- 每次 `setStepProposal/confirmStep/rollbackTo` 后触发一次 `POST`（可做简单去抖）
- 项目切换/进入 onboardingMode 时先 `GET` 拉取一次，若存在则 hydrate 本地 store

### 4.6 接入：新建项目成功后自动进入引导

改动点（建议路径）：
- [header.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/layout/header.tsx#L92-L123)
  - 在 `setNeo4jProject` 后：
    - `initProjectOnboarding(dbName)`（本地）
    - 写入 Neo4j 初始 onboarding state（POST）
    - 设置 `uiStore.projectOnboardingMode = true`
    - `openRightPanel()` 并默认选中第 1 步

### 4.7 任务拆解（可执行子任务列表）

#### A. 基础结构
1) 增加 onboarding 类型文件与 store（本地持久化、按 dbName 隔离）
2) UI store 增加 `projectOnboardingMode` 开关（并提供 toggle/enter/exit actions）

#### B. 引导画布（中心）
3) 实现 `ProjectOnboardingCanvas`（4 节点固定布局、状态显示、点击选择）
4) 在 `OntologyCanvas` 集成切换逻辑

#### C. 引导右侧面板（交互）
5) 实现 Step1（SCOPE）：新增 SSE API + 前端 panel + confirm
6) 实现 Step2（OBJECTS）：复用 object-type-gen + 批量创建 + Neo4j 增量写入
7) 实现 Step3（SCENARIOS）：复用 scenario sandbox + 勾选保存
8) 实现 Step4（ACTIONS）：复用 action-type-gen + 批量创建 + Neo4j 增量写入
9) 完成态：Step4 结束自动退出 onboardingMode

#### D. Neo4j 持久化
10) 新增 `/api/neo4j/onboarding-state`（GET/POST）
11) 前端 store 与 API 同步（hydrate + save）

#### E. 接入与回归
12) 新建项目成功后自动进入（header 接入）
13) 回归现有流程：非 onboarding 时画布/右侧面板不受影响

## 5. Assumptions & Edge Cases（假设与边界情况）

- 若 Neo4j 不可用或写入失败：
  - 本地引导仍可继续（本地 persist）
  - Neo4j 同步失败以非阻塞方式提示，不应中断用户输入/确认
- 用户中途退出/刷新：
  - 本地 persist 可恢复
  - 若本地为空但 Neo4j 有 stateJson，则拉取并恢复
- 回退编辑：
  - 回退到某一步后，后续步骤状态清空并重新锁定，避免“对象变更但动作还沿用旧计划”

## 6. Verification（验证方式）

功能验证（手工路径）：
1) 新建项目成功后自动进入引导画布，画布出现 4 个节点卡片，只有第 1 步可进入
2) Step1 生成并确认后：Step2 解锁；刷新页面仍处于 Step2；切换项目互不影响
3) Step2 批量创建对象类型后：画布（退出 onboarding 后）能看到 ObjectType；Neo4j 增量写入成功
4) Step3 生成场景金字塔并选择保存；回退到 Step2 会清空 Step3 选择
5) Step4 生成并确认后：ActionType 写入；自动退出 onboarding；右侧可继续编辑新建的 ActionType

工程验证：
- `npm run lint`
- `npm run build`

