# 案例剧本交互展示（SCENARIOS.md）— 实施计划

## 1. Summary（目标与交付）

基于 [SCENARIOS.md](file:///Users/johnson_mac/code/ontology-simulator/OSIFile/case/SCENARIOS.md) 的两个案例（餐饮、SAP P2P），在**咨询模式（CONSULTING）**下新增“案例剧本”交互，目标是让用户直观看到：
- 每个意图（Step）用到了哪些本体元素：ObjectType / LinkType / ActionType / BusinessRule / AnalysisInsight(Metric)
- 点击 Step 后，中心图谱自动高亮相关对象/关系；右侧面板可切换到详情编辑（动势/动态/洞察）
- 右侧 LLM 聊天框可持续对话：把当前 Step 作为上下文注入对话，并支持“一键把本步发到聊天”用于迭代改写意图

本期明确不做：
- 真实执行 action（SQL/API/工作流）或模拟回执；只做可视化追踪与编辑联动
- 属性级字段高亮（Property 级别）

## 2. Current State Analysis（基线现状）

### 2.1 咨询模式布局
- Consulting 模式页面布局：左侧固定为业务域规划 [page.tsx](file:///Users/johnson_mac/code/ontology-simulator/app/page.tsx#L33-L45)，右侧为 [ConsultingRightPanel](file:///Users/johnson_mac/code/ontology-simulator/components/consulting/consulting-right-panel.tsx)
- 右侧已有两个 Tab：AI咨询（[consulting-chat-panel.tsx](file:///Users/johnson_mac/code/ontology-simulator/components/consulting/consulting-chat-panel.tsx)）与 详情（Property/Kinetic/Dynamic/语义推演）

### 2.2 图谱高亮能力
- 现有高亮只覆盖节点（ObjectType）：`semanticHighlightedNodeIds`，来源主要在语义查询，落点在 D3 图谱与 ReactFlow 画布
- 尚无 edge(LinkType) 的 semantic 高亮字段，需要扩展 selection-store + 画布渲染才能“意图→关系”高亮

### 2.3 OSI 导入后的三层资产
- OSI 导入已将 datasets/relationships/action_types/rules/metrics 映射进 MetaCore：
  - datasets → ObjectType
  - relationships → LinkType
  - behavior-layer action_types → ActionType（KINETIC）
  - behavior-layer rules → BusinessRule（DYNAMIC）
  - semantic_model.metrics → AnalysisInsight(METRIC)（DYNAMIC）
- 这些资产在左侧分层面板中可见并可进入右侧详情编辑

### 2.4 目前缺失的“案例剧本”能力
- `OSIFile/case/SCENARIOS.md` 仅是文档，不存在 UI 入口
- 缺少“Step → 关联元素”的可视化追踪/高亮/联动机制
- Chat 虽存在，但不会自动携带“当前 Step/用到元素”的结构化上下文

## 3. Decisions（已确认）

- 展示位置：咨询模式（CONSULTING）内
- 执行深度：仅可视化追踪（不执行 action）
- 高亮粒度：对象/关系 + 动作（对象节点高亮 + 关系边高亮；动作/规则/指标用列表与右侧详情联动）

## 4. Proposed Changes（改动方案）

### 4.1 新增：案例剧本数据模型（从 SCENARIOS.md 手工结构化）

新增文件：
- `lib/case-playbook/scenarios.ts`
  - `CasePlaybook[]`：两条案例（餐饮、SAP P2P）
  - 每条包含 `steps[]`：
    - `stepId/title/intentText`（用于聊天上下文）
    - `actionId`（如 `inventory_lots/query_most_expiring`）
    - `inputExampleJson` / `outputExampleJson`（用于右侧展示）
    - `relatedDatasetNames[]`（用于图谱 ObjectType 高亮）
    - `relatedRelationshipNames[]`（可选，用于 LinkType 高亮；未提供则走“连接关系推断”）
    - `relatedMetricNames[]`（用于定位 AnalysisInsight）
    - `notes`（如“补全 join XXX”）

说明：本期采用“手工结构化 TS 数据”的方式，避免引入 Markdown 解析依赖与复杂不确定性；后续可迭代为从 md 自动抽取。

### 4.2 新增：Case Playbook Store（ConsultingStore 扩展）

改动文件：
- `stores/consulting-store.ts`
  - 新增 `casePlaybook` 状态：
    - `selectedCaseId`、`selectedStepId`
    - `editedIntentTextByStepId`（用户在聊天过程中改写意图后可回填）
  - Actions：
    - `selectCase(caseId)` / `selectStep(stepId)`
    - `updateStepIntent(stepId, text)`

### 4.3 Consulting 左侧面板改为 Tabs（业务域规划 / 案例剧本）

新增组件：
- `components/consulting/consulting-left-panel.tsx`
  - Tabs：
    - “业务域规划”：复用现有 [BusinessDomainPlannerPanel](file:///Users/johnson_mac/code/ontology-simulator/components/consulting/business-domain-planner-panel.tsx)
    - “案例剧本”：新增 `CasePlaybookPanel`（见 4.4）

改动点：
- `app/page.tsx`：在 `workMode === "CONSULTING"` 时 leftPanel 改为 `ConsultingLeftPanel`

### 4.4 新增：CasePlaybookPanel（选择 Step → 图谱高亮 + 右侧联动）

新增组件：
- `components/consulting/case-playbook-panel.tsx`

核心交互：
- 选择案例/Step：
  - 根据 `relatedDatasetNames` 找到对应 ObjectType（按 `apiName/displayName` 匹配）
  - 高亮：调用 `useSelectionStore().setSemanticHighlightedNodeIds(objectTypeIds)`
  - 关系高亮（需要 4.5 支撑）：计算相关 LinkType（source/target 都在 objectTypeIds 内 或 命中 `relatedRelationshipNames`）并设置 `semanticHighlightedEdgeIds`
  - 动作/规则/指标联动：
    - Action：在 `actionTypes` 中按 `actionId` 末段（如 `query_most_expiring`）+ `affectedObjectTypeIds` 匹配最佳 ActionType，调用 `selectActionType(actionTypeId)`
    - Rule：按 `appliesToObjectTypeIds` +（可选）关键字匹配 `displayName/apiName`
    - Metric：按 `AnalysisInsight.displayName/apiName` 与 `relatedMetricNames` 匹配，调用 `selectAnalysisInsight(insightId)`
  - 打开右侧并切到详情 Tab（4.6）：`openRightPanel()` + `setConsultingRightTab("details")`

Step 详情展示：
- 展示该 Step 的 actionId + input/output 示例 JSON + “用到的元素”列表（可点击定位到对应条目）
- 提供按钮：“把本步发到聊天”（4.6）

### 4.5 扩展：语义高亮支持 LinkType（Edge）

改动文件：
- `stores/selection-store.ts`
  - 新增 `semanticHighlightedEdgeIds: string[]` + setter/clearer
- `components/graph-canvas/ontology-canvas.tsx`（ReactFlow）
  - edge data 增加 `highlighted`，并在 edge style 根据 `semanticHighlightedEdgeIds` 变色/加粗
- `components/graph-canvas/ontology-knowledge-graph.tsx`（D3）
  - 线条渲染逻辑加入 `semanticHighlightedEdgeIds` 判断，切换 stroke/opacity

### 4.6 Chat 联动：把当前 Step 注入咨询聊天上下文

改动文件：
- `components/consulting/consulting-chat-panel.tsx`
  - 在发送 `/api/consulting-chat` 的 context 中增加 `caseContext`：
    - 当前 case/step、intentText、用到元素摘要（对象/关系/动作/规则/指标）
  - 新增“外部注入消息”的入口：
    - `ConsultingStore` 增加 `draftMessage`（或 `queuedMessages[]`）
    - `CasePlaybookPanel` 点击“把本步发到聊天”时写入 draftMessage 并切到右侧 AI咨询 Tab（同样需要 4.6 的 tab 状态外提）

改动文件：
- `stores/ui-store.ts`
  - 将 `ConsultingRightPanel` 的 tab 状态外提：`consultingRightTab: "consulting" | "details"` + setter
- `components/consulting/consulting-right-panel.tsx`
  - 使用 `ui-store` 的 `consultingRightTab`（便于 CasePlaybookPanel 切换到 AI咨询/详情）

## 5. Assumptions & Edge Cases（假设与边界）

- 若用户未导入 OSI 模型，CasePlaybookPanel 仍可展示步骤，但会提示“未检测到对应本体元素”，不做高亮与联动。
- OSI actionId 与导入后 ActionType 的 apiName 映射可能存在差异：采用“末段关键字 + affectedObjectTypeIds”的启发式匹配；匹配不到则只展示文本，不阻塞流程。
- 不引入执行引擎：所有“驱动能力”以“动作接口/输入输出示例/关联元素追踪”呈现。

## 6. Verification（验证步骤）

1) 导入 OSI YAML（food + pp）成功后进入咨询模式
2) 左侧切换到“案例剧本”，选择场景 1 Step1：
  - 中心图谱高亮 inventory_lots（及相关补全对象）节点；关系边同步高亮
  - 右侧自动切到“详情”，选中对应 ActionType（可见动势面板条目）
3) 点击“把本步发到聊天”：
  - 右侧切到 AI咨询，并将该步意图作为消息或上下文注入
4) 重复验证场景 2 的任意 Step，确保同样联动
5) `npm run lint` + `npm run build` 通过

