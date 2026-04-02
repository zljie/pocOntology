import { MetaCore } from "@/lib/meta/meta-core";
import { OrmMapping } from "@/lib/orm/orm-mapping";

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function tableNameOf(objectTypeId: string, mapping: OrmMapping) {
  return mapping.tables[objectTypeId]?.tableName || objectTypeId;
}

function columnNameOf(objectTypeId: string, propertyId: string, mapping: OrmMapping) {
  return mapping.tables[objectTypeId]?.columns?.[propertyId]?.columnName || propertyId;
}

export function buildErpSqlPreview(params: {
  meta: MetaCore;
  mapping: OrmMapping;
  actionTypeId: string;
  templateVars: Record<string, string>;
}) {
  const { mapping, actionTypeId, templateVars } = params;

  if (actionTypeId === "action-create-pr") {
    const prTable = tableNameOf("purchase-requisition", mapping);
    const cols = [
      ["prNumber", columnNameOf("purchase-requisition", "prNumber", mapping)],
      ["requestDate", columnNameOf("purchase-requisition", "requestDate", mapping)],
      ["requester", columnNameOf("purchase-requisition", "requester", mapping)],
      ["department", columnNameOf("purchase-requisition", "department", mapping)],
      ["status", columnNameOf("purchase-requisition", "status", mapping)],
      ["materialCode", columnNameOf("purchase-requisition", "materialCode", mapping)],
      ["quantity", columnNameOf("purchase-requisition", "quantity", mapping)],
      ["requiredDate", columnNameOf("purchase-requisition", "requiredDate", mapping)],
    ];

    const sql = `insert into ${quoteIdent(prTable)} (
  ${cols.map(([, c]) => quoteIdent(c)).join(",\n  ")}
) values (
  ${cols.map(([k]) => `:${k}`).join(",\n  ")}
)
returning ${quoteIdent(columnNameOf("purchase-requisition", "prNumber", mapping))} as "prNumber";`;

    const vars = {
      prNumber: templateVars.prNumber || "PR20260001",
      requestDate: templateVars.requestDate || new Date().toISOString(),
      requester: templateVars.requester || "张三",
      department: templateVars.department || "采购部",
      status: templateVars.status || "DRAFT",
      materialCode: templateVars.materialCode || "MAT-0001",
      quantity: templateVars.quantity || "10",
      requiredDate: templateVars.requiredDate || new Date().toISOString(),
    };

    return { sql, vars };
  }

  if (actionTypeId === "action-create-po") {
    const poTable = tableNameOf("purchase-order", mapping);
    const cols = [
      ["poNumber", columnNameOf("purchase-order", "poNumber", mapping)],
      ["orderDate", columnNameOf("purchase-order", "orderDate", mapping)],
      ["totalAmount", columnNameOf("purchase-order", "totalAmount", mapping)],
      ["currency", columnNameOf("purchase-order", "currency", mapping)],
      ["status", columnNameOf("purchase-order", "status", mapping)],
      ["supplierId", columnNameOf("purchase-order", "supplierId", mapping)],
      ["prNumber", columnNameOf("purchase-order", "prNumber", mapping)],
    ];

    const sql = `insert into ${quoteIdent(poTable)} (
  ${cols.map(([, c]) => quoteIdent(c)).join(",\n  ")}
) values (
  ${cols.map(([k]) => `:${k}`).join(",\n  ")}
)
returning ${quoteIdent(columnNameOf("purchase-order", "poNumber", mapping))} as "poNumber",
          ${quoteIdent(columnNameOf("purchase-order", "status", mapping))} as "status";`;

    const vars = {
      poNumber: templateVars.poNumber || "PO20260001",
      orderDate: templateVars.orderDate || new Date().toISOString(),
      totalAmount: templateVars.totalAmount || "0",
      currency: templateVars.currency || "CNY",
      status: templateVars.status || "CREATED",
      supplierId: templateVars.supplierId || "SUP-0001",
      prNumber: templateVars.prNumber || "PR20260001",
    };

    return { sql, vars };
  }

  if (actionTypeId === "action-receive-goods") {
    const grTable = tableNameOf("goods-receipt", mapping);
    const poTable = tableNameOf("purchase-order", mapping);

    const grCols = [
      ["grNumber", columnNameOf("goods-receipt", "grNumber", mapping)],
      ["postingDate", columnNameOf("goods-receipt", "postingDate", mapping)],
      ["receivedQuantity", columnNameOf("goods-receipt", "receivedQuantity", mapping)],
      ["qualityStatus", columnNameOf("goods-receipt", "qualityStatus", mapping)],
      ["poNumber", columnNameOf("goods-receipt", "poNumber", mapping)],
      ["deliveryNote", columnNameOf("goods-receipt", "deliveryNote", mapping)],
    ];

    const sql = `with inserted as (
  insert into ${quoteIdent(grTable)} (
    ${grCols.map(([, c]) => quoteIdent(c)).join(",\n    ")}
  ) values (
    ${grCols.map(([k]) => `:${k}`).join(",\n    ")}
  )
  returning ${quoteIdent(columnNameOf("goods-receipt", "grNumber", mapping))} as "grNumber"
)
update ${quoteIdent(poTable)}
set ${quoteIdent(columnNameOf("purchase-order", "status", mapping))} = :poStatus
where ${quoteIdent(columnNameOf("purchase-order", "poNumber", mapping))} = :poNumber;

select "grNumber" from inserted;`;

    const vars = {
      grNumber: templateVars.grNumber || "GR20260001",
      postingDate: templateVars.postingDate || new Date().toISOString(),
      receivedQuantity: templateVars.receivedQuantity || "10",
      qualityStatus: templateVars.qualityStatus || "UNRESTRICTED",
      poNumber: templateVars.poNumber || "PO20260001",
      deliveryNote: templateVars.deliveryNote || "DN-0001",
      poStatus: templateVars.poStatus || "PARTIAL_RECEIPT",
    };

    return { sql, vars };
  }

  return {
    sql: "/* 暂无 SQL 计划：未识别到可落地的 ERP 动作 */",
    vars: templateVars,
  };
}

export function buildSapHcmSqlPreview(params: {
  meta: MetaCore;
  mapping: OrmMapping;
  actionTypeId: string;
  templateVars: Record<string, string>;
}) {
  const { mapping, actionTypeId, templateVars } = params;

  if (actionTypeId === "action-hire-employee") {
    const employeeTable = tableNameOf("employee-hcm", mapping);
    const employmentTable = tableNameOf("employment-hcm", mapping);

    const employeeCols = [
      ["employeeId", columnNameOf("employee-hcm", "employeeId", mapping)],
      ["fullName", columnNameOf("employee-hcm", "fullName", mapping)],
      ["status", columnNameOf("employee-hcm", "status", mapping)],
      ["hireDate", columnNameOf("employee-hcm", "hireDate", mapping)],
      ["orgUnitId", columnNameOf("employee-hcm", "orgUnitId", mapping)],
      ["positionId", columnNameOf("employee-hcm", "positionId", mapping)],
      ["costCenterId", columnNameOf("employee-hcm", "costCenterId", mapping)],
      ["payrollAreaId", columnNameOf("employee-hcm", "payrollAreaId", mapping)],
      ["personnelAreaId", columnNameOf("employee-hcm", "personnelAreaId", mapping)],
    ];

    const employmentCols = [
      ["employmentId", columnNameOf("employment-hcm", "employmentId", mapping)],
      ["employeeId", columnNameOf("employment-hcm", "employeeId", mapping)],
      ["employmentType", columnNameOf("employment-hcm", "employmentType", mapping)],
      ["startDate", columnNameOf("employment-hcm", "startDate", mapping)],
      ["employmentStatus", columnNameOf("employment-hcm", "status", mapping)],
    ];

    const sql = `with inserted_employee as (
  insert into ${quoteIdent(employeeTable)} (
    ${employeeCols.map(([, c]) => quoteIdent(c)).join(",\n    ")}
  ) values (
    ${employeeCols.map(([k]) => `:${k}`).join(",\n    ")}
  )
  returning ${quoteIdent(columnNameOf("employee-hcm", "employeeId", mapping))} as "employeeId"
),
inserted_employment as (
  insert into ${quoteIdent(employmentTable)} (
    ${employmentCols.map(([, c]) => quoteIdent(c)).join(",\n    ")}
  ) values (
    ${employmentCols.map(([k]) => (k === "employeeId" ? `(select "employeeId" from inserted_employee)` : `:${k}`)).join(",\n    ")}
  )
  returning ${quoteIdent(columnNameOf("employment-hcm", "employmentId", mapping))} as "employmentId"
)
select (select "employeeId" from inserted_employee) as "employeeId",
       (select "employmentId" from inserted_employment) as "employmentId";`;

    const vars = {
      employeeId: templateVars.employeeId || "E20260001",
      fullName: templateVars.fullName || "张三",
      status: templateVars.status || "ACTIVE",
      hireDate: templateVars.hireDate || new Date().toISOString(),
      orgUnitId: templateVars.orgUnitId || "OU-1000",
      positionId: templateVars.positionId || "POS-1000",
      costCenterId: templateVars.costCenterId || "CC-1000",
      payrollAreaId: templateVars.payrollAreaId || "PA-01",
      personnelAreaId: templateVars.personnelAreaId || "PE-01",
      employmentId: templateVars.employmentId || "EMP-20260001",
      employmentType: templateVars.employmentType || "FULL_TIME",
      startDate: templateVars.startDate || templateVars.hireDate || new Date().toISOString(),
      employmentStatus: templateVars.employmentStatus || "ACTIVE",
    } as Record<string, string>;
    return { sql, vars };
  }

  if (actionTypeId === "action-transfer-employee") {
    const employeeTable = tableNameOf("employee-hcm", mapping);
    const sql = `update ${quoteIdent(employeeTable)}
set ${quoteIdent(columnNameOf("employee-hcm", "orgUnitId", mapping))} = :orgUnitId,
    ${quoteIdent(columnNameOf("employee-hcm", "positionId", mapping))} = :positionId
where ${quoteIdent(columnNameOf("employee-hcm", "employeeId", mapping))} = :employeeId
returning ${quoteIdent(columnNameOf("employee-hcm", "employeeId", mapping))} as "employeeId";`;
    const vars = {
      employeeId: templateVars.employeeId || "E20260001",
      orgUnitId: templateVars.orgUnitId || "OU-2000",
      positionId: templateVars.positionId || "POS-2000",
      effectiveDate: templateVars.effectiveDate || new Date().toISOString(),
    };
    return { sql, vars };
  }

  if (actionTypeId === "action-record-time-entry") {
    const timeTable = tableNameOf("time-entry-hcm", mapping);
    const cols = [
      ["timeEntryId", columnNameOf("time-entry-hcm", "timeEntryId", mapping)],
      ["employeeId", columnNameOf("time-entry-hcm", "employeeId", mapping)],
      ["workDate", columnNameOf("time-entry-hcm", "workDate", mapping)],
      ["hours", columnNameOf("time-entry-hcm", "hours", mapping)],
      ["timeType", columnNameOf("time-entry-hcm", "timeType", mapping)],
      ["status", columnNameOf("time-entry-hcm", "status", mapping)],
    ];
    const sql = `insert into ${quoteIdent(timeTable)} (
  ${cols.map(([, c]) => quoteIdent(c)).join(",\n  ")}
) values (
  ${cols.map(([k]) => `:${k}`).join(",\n  ")}
)
returning ${quoteIdent(columnNameOf("time-entry-hcm", "timeEntryId", mapping))} as "timeEntryId";`;
    const vars = {
      timeEntryId: templateVars.timeEntryId || "TE-20260001",
      employeeId: templateVars.employeeId || "E20260001",
      workDate: templateVars.workDate || new Date().toISOString(),
      hours: templateVars.hours || "8",
      timeType: templateVars.timeType || "WORK",
      status: templateVars.status || "SUBMITTED",
    };
    return { sql, vars };
  }

  if (actionTypeId === "action-request-absence") {
    const absTable = tableNameOf("absence-request-hcm", mapping);
    const cols = [
      ["requestId", columnNameOf("absence-request-hcm", "requestId", mapping)],
      ["employeeId", columnNameOf("absence-request-hcm", "employeeId", mapping)],
      ["absenceType", columnNameOf("absence-request-hcm", "absenceType", mapping)],
      ["startDate", columnNameOf("absence-request-hcm", "startDate", mapping)],
      ["endDate", columnNameOf("absence-request-hcm", "endDate", mapping)],
      ["status", columnNameOf("absence-request-hcm", "status", mapping)],
    ];
    const sql = `insert into ${quoteIdent(absTable)} (
  ${cols.map(([, c]) => quoteIdent(c)).join(",\n  ")}
) values (
  ${cols.map(([k]) => `:${k}`).join(",\n  ")}
)
returning ${quoteIdent(columnNameOf("absence-request-hcm", "requestId", mapping))} as "requestId",
          ${quoteIdent(columnNameOf("absence-request-hcm", "status", mapping))} as "status";`;
    const vars = {
      requestId: templateVars.requestId || "AR-20260001",
      employeeId: templateVars.employeeId || "E20260001",
      absenceType: templateVars.absenceType || "ANNUAL",
      startDate: templateVars.startDate || new Date().toISOString(),
      endDate: templateVars.endDate || new Date().toISOString(),
      status: templateVars.status || "PENDING",
    };
    return { sql, vars };
  }

  if (actionTypeId === "action-approve-absence") {
    const absTable = tableNameOf("absence-request-hcm", mapping);
    const sql = `update ${quoteIdent(absTable)}
set ${quoteIdent(columnNameOf("absence-request-hcm", "status", mapping))} = :status,
    ${quoteIdent(columnNameOf("absence-request-hcm", "approverEmployeeId", mapping))} = :approverEmployeeId,
    ${quoteIdent(columnNameOf("absence-request-hcm", "approvedAt", mapping))} = :approvedAt
where ${quoteIdent(columnNameOf("absence-request-hcm", "requestId", mapping))} = :requestId
returning ${quoteIdent(columnNameOf("absence-request-hcm", "requestId", mapping))} as "requestId",
          ${quoteIdent(columnNameOf("absence-request-hcm", "status", mapping))} as "status";`;
    const decision = (templateVars.decision || "APPROVE").toUpperCase();
    const status = decision === "REJECT" ? "REJECTED" : "APPROVED";
    const vars = {
      requestId: templateVars.requestId || "AR-20260001",
      approverEmployeeId: templateVars.approverEmployeeId || "E20260002",
      decision,
      status,
      approvedAt: templateVars.approvedAt || new Date().toISOString(),
    };
    return { sql, vars };
  }

  if (actionTypeId === "action-run-payroll") {
    const runTable = tableNameOf("payroll-run-hcm", mapping);
    const cols = [
      ["payrollRunId", columnNameOf("payroll-run-hcm", "payrollRunId", mapping)],
      ["payrollAreaId", columnNameOf("payroll-run-hcm", "payrollAreaId", mapping)],
      ["periodStart", columnNameOf("payroll-run-hcm", "periodStart", mapping)],
      ["periodEnd", columnNameOf("payroll-run-hcm", "periodEnd", mapping)],
      ["runDate", columnNameOf("payroll-run-hcm", "runDate", mapping)],
      ["status", columnNameOf("payroll-run-hcm", "status", mapping)],
    ];
    const sql = `insert into ${quoteIdent(runTable)} (
  ${cols.map(([, c]) => quoteIdent(c)).join(",\n  ")}
) values (
  ${cols.map(([k]) => `:${k}`).join(",\n  ")}
)
returning ${quoteIdent(columnNameOf("payroll-run-hcm", "payrollRunId", mapping))} as "payrollRunId",
          ${quoteIdent(columnNameOf("payroll-run-hcm", "status", mapping))} as "status";`;
    const vars = {
      payrollRunId: templateVars.payrollRunId || "PRUN-20260001",
      payrollAreaId: templateVars.payrollAreaId || "PA-01",
      periodStart: templateVars.periodStart || new Date().toISOString(),
      periodEnd: templateVars.periodEnd || new Date().toISOString(),
      runDate: templateVars.runDate || new Date().toISOString(),
      status: templateVars.status || "CREATED",
    };
    return { sql, vars };
  }

  return {
    sql: "/* 暂无 SQL 计划：未识别到可落地的 HCM 动作 */",
    vars: templateVars,
  };
}
