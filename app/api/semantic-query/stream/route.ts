import { NextRequest } from "next/server";
import {
  ERP_ACTION_TYPES,
  ERP_AI_MODELS,
  ERP_ANALYSIS_INSIGHTS,
  ERP_BUSINESS_RULES,
  ERP_DATA_FLOWS,
  ERP_LINK_TYPES,
  ERP_OBJECT_TYPES,
} from "@/lib/types/ontology-erp-sample";
import { buildErpOrmMapping } from "@/lib/orm/erp";
import { buildDefaultOrmMapping } from "@/lib/orm/postgres";
import { buildErpSqlPreview, buildSapHcmSqlPreview } from "@/lib/semantic/sql";
import {
  SAP_HCM_ACTION_TYPES,
  SAP_HCM_AI_MODELS,
  SAP_HCM_ANALYSIS_INSIGHTS,
  SAP_HCM_BUSINESS_RULES,
  SAP_HCM_DATA_FLOWS,
  SAP_HCM_LINK_TYPES,
  SAP_HCM_OBJECT_TYPES,
} from "@/lib/types/ontology-sap-hcm-sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;

const BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M2.7";

function buildMessagesUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/messages")) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/messages`;
  }
  return `${normalized}/v1/messages`;
}

function safeParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const block = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
    if (!block) return null;
    try {
      return JSON.parse(block);
    } catch {
      return null;
    }
  }
}

function extractTextBlocks(content: any[] = []) {
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function fallbackParsedResult(query: string) {
  const isErp =
    query.includes("采购") ||
    query.includes("PR") ||
    query.includes("PO") ||
    query.includes("收货") ||
    query.includes("入库") ||
    query.includes("供应商") ||
    query.includes("物料");
  const isCreatePr = query.includes("采购申请") || query.includes("创建采购申请") || (isErp && query.includes("申请"));
  const isCreatePo = query.includes("采购订单") || query.includes("创建采购订单") || query.includes("提交订单") || (isErp && query.includes("订购"));
  const isReceive = query.includes("收货") || query.includes("入库");
  const isHcm =
    !isErp &&
    (query.includes("入职") ||
      query.includes("调岗") ||
      query.includes("调动") ||
      query.includes("请假") ||
      query.includes("休假") ||
      query.includes("工时") ||
      query.includes("考勤") ||
      query.includes("加班") ||
      query.includes("跑薪") ||
      query.includes("发薪") ||
      query.includes("薪资") ||
      query.includes("工资") ||
      query.includes("员工") ||
      query.includes("人事"));
  const isHire = isHcm && (query.includes("入职") || query.includes("办理入职") || query.includes("新增员工"));
  const isTransfer = isHcm && (query.includes("调岗") || query.includes("调动") || query.includes("转岗") || query.includes("转部门"));
  const isApproveAbsence = isHcm && query.includes("审批") && (query.includes("请假") || query.includes("休假"));
  const isRequestAbsence = isHcm && (query.includes("请假") || query.includes("休假")) && !isApproveAbsence;
  const isRecordTime = isHcm && (query.includes("工时") || query.includes("考勤") || query.includes("加班"));
  const isRunPayroll = isHcm && (query.includes("跑薪") || query.includes("发薪") || query.includes("薪资计算") || query.includes("工资"));
  const isReturn = query.includes("还");

  const action =
    isErp && isCreatePr
      ? { id: "action-create-pr", name: "CreatePR", displayName: "创建采购申请", layer: "KINETIC" }
      : isErp && isReceive
      ? { id: "action-receive-goods", name: "ReceiveGoods", displayName: "收货过账", layer: "KINETIC" }
      : isErp && isCreatePo
      ? { id: "action-create-po", name: "CreatePO", displayName: "创建采购订单", layer: "KINETIC" }
      : isHire
      ? { id: "action-hire-employee", name: "HireEmployee", displayName: "员工入职", layer: "KINETIC" }
      : isTransfer
      ? { id: "action-transfer-employee", name: "TransferEmployee", displayName: "员工调岗", layer: "KINETIC" }
      : isRecordTime
      ? { id: "action-record-time-entry", name: "RecordTimeEntry", displayName: "记录工时", layer: "KINETIC" }
      : isRequestAbsence
      ? { id: "action-request-absence", name: "RequestAbsence", displayName: "发起请假", layer: "KINETIC" }
      : isApproveAbsence
      ? { id: "action-approve-absence", name: "ApproveAbsence", displayName: "审批请假", layer: "KINETIC" }
      : isRunPayroll
      ? { id: "action-run-payroll", name: "RunPayroll", displayName: "运行薪资计算", layer: "KINETIC" }
      : isReturn
      ? { id: "action-return", name: "ReturnBook", displayName: "还书", layer: "KINETIC" }
      : { id: "action-checkout", name: "CheckoutBook", displayName: "借书", layer: "KINETIC" };
  return {
    action,
    entities:
      isErp && action.id === "action-create-pr"
        ? [
            { type: "OBJECT_TYPE", id: "purchase-requisition", name: "PurchaseRequisition", displayName: "采购申请", confidence: 0.9, matchedText: "采购申请" },
            { type: "OBJECT_TYPE", id: "material-erp", name: "Material", displayName: "物料", confidence: 0.82, matchedText: "物料" }
          ]
        : isErp && action.id === "action-create-po"
        ? [
            { type: "OBJECT_TYPE", id: "purchase-order", name: "PurchaseOrder", displayName: "采购订单", confidence: 0.9, matchedText: "订单" },
            { type: "OBJECT_TYPE", id: "purchase-requisition", name: "PurchaseRequisition", displayName: "采购申请", confidence: 0.78, matchedText: "PR" },
            { type: "OBJECT_TYPE", id: "supplier-erp", name: "Supplier", displayName: "供应商", confidence: 0.8, matchedText: "供应商" }
          ]
        : isErp && action.id === "action-receive-goods"
        ? [
            { type: "OBJECT_TYPE", id: "goods-receipt", name: "GoodsReceipt", displayName: "收货单", confidence: 0.9, matchedText: "收货" },
            { type: "OBJECT_TYPE", id: "purchase-order", name: "PurchaseOrder", displayName: "采购订单", confidence: 0.82, matchedText: "PO" }
          ]
        : action.id === "action-hire-employee" || action.id === "action-transfer-employee"
        ? [
            { type: "OBJECT_TYPE", id: "employee-hcm", name: "Employee", displayName: "员工", confidence: 0.9, matchedText: "员工" },
            { type: "OBJECT_TYPE", id: "org-unit-hcm", name: "OrgUnit", displayName: "组织单元", confidence: 0.82, matchedText: "组织" },
            { type: "OBJECT_TYPE", id: "position-hcm", name: "Position", displayName: "岗位", confidence: 0.82, matchedText: "岗位" }
          ]
        : action.id === "action-record-time-entry"
        ? [
            { type: "OBJECT_TYPE", id: "time-entry-hcm", name: "TimeEntry", displayName: "工时记录", confidence: 0.88, matchedText: "工时" },
            { type: "OBJECT_TYPE", id: "employee-hcm", name: "Employee", displayName: "员工", confidence: 0.78, matchedText: "员工" }
          ]
        : action.id === "action-request-absence" || action.id === "action-approve-absence"
        ? [
            { type: "OBJECT_TYPE", id: "absence-request-hcm", name: "AbsenceRequest", displayName: "请假申请", confidence: 0.88, matchedText: "请假" },
            { type: "OBJECT_TYPE", id: "employee-hcm", name: "Employee", displayName: "员工", confidence: 0.78, matchedText: "员工" }
          ]
        : action.id === "action-run-payroll"
        ? [
            { type: "OBJECT_TYPE", id: "payroll-run-hcm", name: "PayrollRun", displayName: "跑薪批次", confidence: 0.86, matchedText: "跑薪" },
            { type: "OBJECT_TYPE", id: "payroll-result-hcm", name: "PayrollResult", displayName: "薪资结果", confidence: 0.78, matchedText: "薪资" }
          ]
        : isReturn
        ? [{ type: "OBJECT_TYPE", id: "loan-001", name: "Loan", displayName: "借阅记录", confidence: 0.9, matchedText: "还书" }]
        : [{ type: "OBJECT_TYPE", id: "book-001", name: "Book", displayName: "图书", confidence: 0.88, matchedText: "图书" }],
    suggestedProperties: [],
    output: isReturn
      ? [{ propertyId: "actualReturnDate", propertyName: "actualReturnDate", displayName: "实际归还时间", description: "记录归还时间" }]
      : isHcm
      ? [{ propertyId: "result", propertyName: "result", displayName: "结果", description: "返回动作执行结果字段" }]
      : [{ propertyId: "loanId", propertyName: "loanId", displayName: "借阅ID", description: "生成借阅记录编号" }],
  };
}

function fallbackPreview(query: string) {
  const barcode = query.match(/(?:条码号?|barcode)\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] || "ABC123";
  const prNumber =
    query.match(/\bPR\s*([A-Za-z0-9_-]+)\b/i)?.[0]?.replace(/\s+/g, "") ||
    query.match(/PR编号\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] ||
    "PR20260001";
  const supplierId =
    query.match(/\bSUP\s*([A-Za-z0-9_-]+)\b/i)?.[0]?.replace(/\s+/g, "") ||
    query.match(/供应商编码\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] ||
    "SUP-0001";
  const poNumber =
    query.match(/\bPO\s*([A-Za-z0-9_-]+)\b/i)?.[0]?.replace(/\s+/g, "") ||
    query.match(/PO编号\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] ||
    "PO20260001";
  const materialCode =
    query.match(/物料编码\s*[:：]?\s*([A-Za-z0-9_-]+)/i)?.[1] ||
    "MAT-0001";
  const quantity = query.match(/(\d+(?:\.\d+)?)\s*(?:个|件|箱|吨|kg|KG|千克)?/)?.[1] || "10";
  const employeeId =
    query.match(/(?:员工|工号)\s*[:：]?\s*([A-Za-z0-9_-]+)/)?.[1] ||
    query.match(/\bE[0-9]{3,}\b/i)?.[0] ||
    "E20260001";
  const orgUnitId = query.match(/\bOU[-_A-Za-z0-9]+\b/i)?.[0] || "OU-1000";
  const positionId = query.match(/\bPOS[-_A-Za-z0-9]+\b/i)?.[0] || "POS-1000";
  const costCenterId = query.match(/\bCC[-_A-Za-z0-9]+\b/i)?.[0] || "CC-1000";
  const requestId = query.match(/\bAR[-_A-Za-z0-9]+\b/i)?.[0] || "AR-20260001";
  const payrollAreaId = query.match(/\bPA[-_A-Za-z0-9]+\b/i)?.[0] || "PA-01";
  const hours = query.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|H)/)?.[1] || "8";

  const isErp =
    query.includes("采购") ||
    query.includes("PR") ||
    query.includes("PO") ||
    query.includes("收货") ||
    query.includes("入库") ||
    query.includes("供应商") ||
    query.includes("物料");
  const isCreatePr = query.includes("采购申请") || query.includes("创建采购申请") || (isErp && query.includes("申请"));
  const isCreatePo = query.includes("采购订单") || query.includes("创建采购订单") || query.includes("提交订单") || (isErp && query.includes("订购"));
  const isReceive = query.includes("收货") || query.includes("入库");
  const isHcm =
    !isErp &&
    (query.includes("入职") ||
      query.includes("调岗") ||
      query.includes("调动") ||
      query.includes("请假") ||
      query.includes("休假") ||
      query.includes("工时") ||
      query.includes("考勤") ||
      query.includes("加班") ||
      query.includes("跑薪") ||
      query.includes("发薪") ||
      query.includes("薪资") ||
      query.includes("工资") ||
      query.includes("员工") ||
      query.includes("人事"));
  const isHire = isHcm && (query.includes("入职") || query.includes("办理入职") || query.includes("新增员工"));
  const isTransfer = isHcm && (query.includes("调岗") || query.includes("调动") || query.includes("转岗") || query.includes("转部门"));
  const isApproveAbsence = isHcm && query.includes("审批") && (query.includes("请假") || query.includes("休假"));
  const isRequestAbsence = isHcm && (query.includes("请假") || query.includes("休假")) && !isApproveAbsence;
  const isRecordTime = isHcm && (query.includes("工时") || query.includes("考勤") || query.includes("加班"));
  const isRunPayroll = isHcm && (query.includes("跑薪") || query.includes("发薪") || query.includes("薪资计算") || query.includes("工资"));

  if (isErp && isCreatePr) {
    const templateVars = { materialCode, quantity, requiredDate: new Date().toISOString() };
    const sql = buildErpSqlPreview({
      meta: {
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      },
      mapping: buildErpOrmMapping({
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      }),
      actionTypeId: "action-create-pr",
      templateVars,
    });
    return {
      semanticScenario: "系统将采购申请语义转义为 PR 创建动作，并映射为接口调用与数据库写入计划。",
      rdf: `lib:ERP_Action_CreatePR a lib:Action .`,
      owl: `Class: lib:ERPAction\n  Annotations: rdfs:label \"ERP采购动作\"`,
      swrl: `lib:Rule_PR_Validation a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION CreatePR WITH PurchaseRequisition.materialCode=\"${materialCode}\", quantity=${quantity}`,
      graphqlTemplate:
        `mutation CreatePurchaseRequisition($materialCode: String!, $quantity: Float!, $requiredDate: String!) {\n  createPurchaseRequisition(input: { materialCode: $materialCode, quantity: $quantity, requiredDate: $requiredDate }) {\n    prNumber\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isErp && isCreatePo) {
    const templateVars = { prNumber, supplierId };
    const sql = buildErpSqlPreview({
      meta: {
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      },
      mapping: buildErpOrmMapping({
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      }),
      actionTypeId: "action-create-po",
      templateVars,
    });
    return {
      semanticScenario: "系统将提交订单语义转义为 PO 创建动作，并映射为接口调用与数据库写入计划。",
      rdf: `lib:ERP_Action_CreatePO a lib:Action .`,
      owl: `Class: lib:ERPAction\n  Annotations: rdfs:label \"ERP采购动作\"`,
      swrl: `lib:Rule_PO_Validation a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION CreatePO WITH PurchaseOrder.prNumber=\"${prNumber}\", supplierId=\"${supplierId}\"`,
      graphqlTemplate:
        `mutation CreatePurchaseOrder($prNumber: String!, $supplierId: String!) {\n  createPurchaseOrder(input: { prNumber: $prNumber, supplierId: $supplierId }) {\n    poNumber\n    status\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isErp && isReceive) {
    const templateVars = { poNumber, deliveryNote: "DN-0001", receivedQuantity: quantity };
    const sql = buildErpSqlPreview({
      meta: {
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      },
      mapping: buildErpOrmMapping({
        scenario: "erp",
        objectTypes: ERP_OBJECT_TYPES,
        linkTypes: ERP_LINK_TYPES,
        actionTypes: ERP_ACTION_TYPES,
        dataFlows: ERP_DATA_FLOWS,
        businessRules: ERP_BUSINESS_RULES,
        aiModels: ERP_AI_MODELS,
        analysisInsights: ERP_ANALYSIS_INSIGHTS,
      }),
      actionTypeId: "action-receive-goods",
      templateVars,
    });
    return {
      semanticScenario: "系统将收货语义转义为 GR 过账动作，并映射为接口调用与数据库写入计划。",
      rdf: `lib:ERP_Action_ReceiveGoods a lib:Action .`,
      owl: `Class: lib:ERPAction\n  Annotations: rdfs:label \"ERP采购动作\"`,
      swrl: `lib:Rule_GR_Validation a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION ReceiveGoods WITH GoodsReceipt.poNumber=\"${poNumber}\", receivedQuantity=${quantity}`,
      graphqlTemplate:
        `mutation PostGoodsReceipt($poNumber: String!, $deliveryNote: String!, $receivedQuantity: Float!) {\n  postGoodsReceipt(input: { poNumber: $poNumber, deliveryNote: $deliveryNote, receivedQuantity: $receivedQuantity }) {\n    grNumber\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isHire) {
    const templateVars = {
      employeeId,
      fullName: "张三",
      orgUnitId,
      positionId,
      costCenterId,
      payrollAreaId,
      personnelAreaId: "PE-01",
      employmentType: "FULL_TIME",
      hireDate: new Date().toISOString(),
    };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-hire-employee", templateVars });
    return {
      semanticScenario: "系统将入职语义转义为人员主数据创建，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_HireEmployee a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_Employee_Assignment a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION HireEmployee WITH Employee.employeeId=\"${employeeId}\", Employee.orgUnitId=\"${orgUnitId}\", Employee.positionId=\"${positionId}\"`,
      graphqlTemplate:
        `mutation HireEmployee($employeeId: String!, $fullName: String!, $orgUnitId: String!, $positionId: String!, $costCenterId: String!, $payrollAreaId: String!, $personnelAreaId: String!, $employmentType: String!, $hireDate: String!) {\n  hireEmployee(input: { employeeId: $employeeId, fullName: $fullName, orgUnitId: $orgUnitId, positionId: $positionId, costCenterId: $costCenterId, payrollAreaId: $payrollAreaId, personnelAreaId: $personnelAreaId, employmentType: $employmentType, hireDate: $hireDate }) {\n    employeeId\n    status\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isTransfer) {
    const templateVars = { employeeId, orgUnitId, positionId, effectiveDate: new Date().toISOString() };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-transfer-employee", templateVars });
    return {
      semanticScenario: "系统将调岗语义转义为人员任职信息更新，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_TransferEmployee a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_Transfer_Validation a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION TransferEmployee WITH Employee.employeeId=\"${employeeId}\", Employee.orgUnitId=\"${orgUnitId}\", Employee.positionId=\"${positionId}\"`,
      graphqlTemplate:
        `mutation TransferEmployee($employeeId: String!, $orgUnitId: String!, $positionId: String!, $effectiveDate: String!) {\n  transferEmployee(input: { employeeId: $employeeId, orgUnitId: $orgUnitId, positionId: $positionId, effectiveDate: $effectiveDate }) {\n    employeeId\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isRecordTime) {
    const templateVars = { timeEntryId: "TE-20260001", employeeId, workDate: new Date().toISOString(), hours, timeType: "WORK" };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-record-time-entry", templateVars });
    return {
      semanticScenario: "系统将工时语义转义为工时记录写入，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_RecordTimeEntry a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_TimeEntry_Validation a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION RecordTimeEntry WITH TimeEntry.employeeId=\"${employeeId}\", hours=${hours}`,
      graphqlTemplate:
        `mutation RecordTimeEntry($employeeId: String!, $workDate: String!, $hours: Float!, $timeType: String!) {\n  recordTimeEntry(input: { employeeId: $employeeId, workDate: $workDate, hours: $hours, timeType: $timeType }) {\n    timeEntryId\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isRequestAbsence) {
    const templateVars = { requestId, employeeId, absenceType: "ANNUAL", startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: "PENDING" };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-request-absence", templateVars });
    return {
      semanticScenario: "系统将请假语义转义为请假申请创建，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_RequestAbsence a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_Absence_DateRange a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION RequestAbsence WITH AbsenceRequest.employeeId=\"${employeeId}\"`,
      graphqlTemplate:
        `mutation RequestAbsence($employeeId: String!, $absenceType: String!, $startDate: String!, $endDate: String!) {\n  requestAbsence(input: { employeeId: $employeeId, absenceType: $absenceType, startDate: $startDate, endDate: $endDate }) {\n    requestId\n    status\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isApproveAbsence) {
    const templateVars = { requestId, approverEmployeeId: "E20260002", decision: "APPROVE" };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-approve-absence", templateVars });
    return {
      semanticScenario: "系统将请假审批语义转义为审批状态更新，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_ApproveAbsence a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_Absence_Transition a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION ApproveAbsence WITH AbsenceRequest.requestId=\"${requestId}\"`,
      graphqlTemplate:
        `mutation ApproveAbsence($requestId: String!, $approverEmployeeId: String!, $decision: String!) {\n  approveAbsence(input: { requestId: $requestId, approverEmployeeId: $approverEmployeeId, decision: $decision }) {\n    requestId\n    status\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (isRunPayroll) {
    const templateVars = { payrollRunId: "PRUN-20260001", payrollAreaId, periodStart: new Date().toISOString(), periodEnd: new Date().toISOString(), status: "CREATED" };
    const meta = {
      scenario: "sap_hcm" as const,
      objectTypes: SAP_HCM_OBJECT_TYPES,
      linkTypes: SAP_HCM_LINK_TYPES,
      actionTypes: SAP_HCM_ACTION_TYPES,
      dataFlows: SAP_HCM_DATA_FLOWS,
      businessRules: SAP_HCM_BUSINESS_RULES,
      aiModels: SAP_HCM_AI_MODELS,
      analysisInsights: SAP_HCM_ANALYSIS_INSIGHTS,
    };
    const mapping = buildDefaultOrmMapping(meta);
    mapping.databaseName = "sap_hcm";
    mapping.schemaName = "hcm";
    const sql = buildSapHcmSqlPreview({ meta, mapping, actionTypeId: "action-run-payroll", templateVars });
    return {
      semanticScenario: "系统将跑薪语义转义为跑薪批次创建，并映射为接口调用与数据库写入计划。",
      rdf: `lib:HCM_Action_RunPayroll a lib:Action .`,
      owl: `Class: lib:HCMAction\n  Annotations: rdfs:label \"HCM 人事动作\"`,
      swrl: `lib:Rule_Payroll_Run a lib:BusinessRule ;\n  lib:then \"\"\" true \"\"\" .`,
      dsl: `ACTION RunPayroll WITH PayrollRun.payrollAreaId=\"${payrollAreaId}\"`,
      graphqlTemplate:
        `mutation RunPayroll($payrollAreaId: String!, $periodStart: String!, $periodEnd: String!) {\n  runPayroll(input: { payrollAreaId: $payrollAreaId, periodStart: $periodStart, periodEnd: $periodEnd }) {\n    payrollRunId\n    status\n  }\n}`,
      templateVars,
      sql: sql.sql,
      sqlVars: sql.vars,
    };
  }

  if (query.includes("还")) {
    return {
      semanticScenario: "系统将归还语义转义为 ReturnEvent，关联 Loan 与 Holding 并更新状态。",
      rdf: `lib:Event_Return_001 a lib:ReturnEvent ;\n  lib:updatesLoan lib:Loan_${barcode} .`,
      owl: `Class: lib:ReturnEvent\n  SubClassOf: lib:Event\n  Annotations: rdfs:label "归还事件"`,
      swrl: `lib:Rule_归还状态同步 a lib:BusinessRule ;\n  lib:then """ ?loan lib:loanStatus "RETURNED" . """ .`,
      dsl: `ACTION ReturnBook WITH Holding.barcode="${barcode}"`,
      graphqlTemplate:
        `mutation ReturnBook($barcode: String!) {\n  returnBook(input: { barcode: $barcode }) {\n    loanId\n    loanStatus\n    holdingStatus\n    actualReturnDate\n  }\n}`,
      templateVars: { barcode },
    };
  }
  return {
    semanticScenario: "系统将借阅语义转义为 BorrowingEvent，绑定读者与馆藏并生成借阅记录。",
    rdf: `lib:Event_Loan_001 a lib:BorrowingEvent ;\n  lib:object lib:Book_目标图书 .`,
    owl: `Class: lib:BorrowingEvent\n  SubClassOf: lib:Event\n  Annotations: rdfs:label "借阅事件"`,
    swrl: `lib:Rule_借阅可用性 a lib:BusinessRule ;\n  lib:then """ ?loan lib:loanStatus "ACTIVE" . """ .`,
    dsl: `ACTION CheckoutBook WITH Book.title="目标图书"`,
    graphqlTemplate:
      `mutation CheckoutBook($bookTitle: String!, $patronName: String!) {\n  checkoutBook(input: { bookTitle: $bookTitle, patronName: $patronName }) {\n    loanId\n    dueDate\n    loanStatus\n  }\n}`,
    templateVars: { bookTitle: "目标图书", patronName: "张三" },
  };
}

async function requestAgentText(apiKey: string, prompt: string, maxTokens = 1200) {
  const payload = {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    system: "你是本体语义建模专家。",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  const response = await fetch(buildMessagesUrl(BASE_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM Request Failed:", response.status, errorText);
    return { text: "", stopReason: "http_error" as const };
  }

  const result = await response.json();
  return {
    text: extractTextBlocks(result?.content || []),
    stopReason: typeof result?.stop_reason === "string" ? result.stop_reason : "",
  };
}

function splitTextByChunk(text: string, size = 20) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
  const body = await req.json().catch(() => null);
  const query = body?.query?.toString?.().trim?.();

  if (!query) {
    return new Response("query 不能为空", { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, payload: Record<string, any>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const introPrompt = `请用中文向用户解释：基于当前系统中的本体模型，会如何把输入语句转换为语义对象、参数、规则与查询执行结构。当需要输出框架图、架构图或流程图时，请强制使用 mermaid 语法（以 \`\`\`mermaid 开头）。输入：${query}`;
        const parsedPrompt = `仅返回 JSON，不要额外文本。输出 parsedResult 字段，schema: {"parsedResult":{"action":{"id":"string","name":"string","displayName":"string","layer":"KINETIC"},"entities":[],"suggestedProperties":[],"output":[]}}。输入：${query}`;
        const previewPrompt = `仅返回 JSON，不要额外文本。输出 schema: {"semanticScenario":"string","rdf":"string","owl":"string","swrl":"string","dsl":"string","graphqlTemplate":"string","templateVars":{"k":"v"}}。输入：${query}`;

        const introResponse = apiKey ? await requestAgentText(apiKey, introPrompt, 10000) : { text: "", stopReason: "" };
        const introText =
          introResponse.text ||
          "我将先根据本体层级识别动作、实体和属性，再由并行 Agent 分别生成解析结果与语义化查询语句预览。";
        const finalIntroText =
          introResponse.stopReason === "max_tokens"
            ? `${introText}\n\n（提示：本次说明已达到模型输出长度上限，可能存在截断。你可以在下方继续追问“继续/补充细节”。）`
            : introText;

        const introChunks = splitTextByChunk(finalIntroText, 18);
        for (const chunk of introChunks) {
          send(controller, { type: "intro_delta", delta: chunk });
          await sleep(30);
        }
        send(controller, { type: "intro_done", intro: finalIntroText });

        const parsedTask = (async () => {
          if (!apiKey) return fallbackParsedResult(query);
          const parsedResponse = await requestAgentText(apiKey, parsedPrompt, 1800);
          const parsedJson = safeParseJSON(parsedResponse.text);
          return parsedJson?.parsedResult || fallbackParsedResult(query);
        })();

        const previewTask = (async () => {
          if (!apiKey) return fallbackPreview(query);
          const previewResponse = await requestAgentText(apiKey, previewPrompt, 1800);
          const previewJson = safeParseJSON(previewResponse.text);
          const fallback = fallbackPreview(query);
          return {
            semanticScenario: previewJson?.semanticScenario || fallback.semanticScenario,
            rdf: previewJson?.rdf || fallback.rdf,
            owl: previewJson?.owl || fallback.owl,
            swrl: previewJson?.swrl || fallback.swrl,
            dsl: previewJson?.dsl || fallback.dsl,
            graphqlTemplate: previewJson?.graphqlTemplate || fallback.graphqlTemplate,
            templateVars:
              previewJson?.templateVars && typeof previewJson.templateVars === "object"
                ? Object.fromEntries(
                    Object.entries(previewJson.templateVars).map(([key, value]) => [String(key), String(value ?? "")])
                  )
                : fallback.templateVars,
          };
        })();

        const [parsedResult, preview] = await Promise.all([parsedTask, previewTask]);
        send(controller, { type: "parsed_result", parsedResult });
        send(controller, { type: "preview_result", preview });
        send(controller, { type: "done" });
        controller.close();
      } catch (error: any) {
        send(controller, { type: "error", message: error?.message || "流式解析失败" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
