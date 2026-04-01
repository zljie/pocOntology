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

