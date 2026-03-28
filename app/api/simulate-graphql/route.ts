import { NextRequest, NextResponse } from "next/server";

type TemplateVars = Record<string, string>;

function extractOperationName(graphqlTemplate: string) {
  const match = graphqlTemplate.match(/\b(query|mutation)\s+([A-Za-z0-9_]+)/i);
  return {
    operationType: (match?.[1]?.toUpperCase() || "MUTATION") as "QUERY" | "MUTATION",
    operationName: match?.[2] || "AnonymousOperation",
  };
}

function simulateGraphQLResult(operationName: string, templateVars: TemplateVars) {
  if (operationName === "ReturnBook") {
    return {
      returnBook: {
        loanId: `LN-${Date.now()}`,
        loanStatus: "RETURNED",
        holdingStatus: "AVAILABLE",
        actualReturnDate: new Date().toISOString(),
        barcode: templateVars.barcode || "",
      },
    };
  }

  if (operationName === "RenewLoan") {
    return {
      renewLoan: {
        loanId: `LN-${Date.now()}`,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        renewalCount: Number(templateVars.renewDays ? 1 : 0) + 1,
      },
    };
  }

  if (operationName === "QueryOverdueFine") {
    return {
      overdueFines: [
        { loanId: "LN-1001", amount: 12.5, daysOverdue: 5 },
        { loanId: "LN-1088", amount: 6, daysOverdue: 2 },
      ],
    };
  }

  if (operationName === "CreatePO" || operationName === "CreatePurchaseOrder") {
    return {
      createPurchaseOrder: {
        poNumber: `PO-${Date.now()}`,
        status: "CREATED",
        supplierId: templateVars.supplierId || "S1001",
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (operationName === "CreatePR" || operationName === "CreatePurchaseRequisition") {
    return {
      createPurchaseRequisition: {
        prNumber: `PR-${Date.now()}`,
        status: "PENDING",
        materialCode: templateVars.materialCode || "M001",
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (operationName === "ReceiveGoods") {
    return {
      receiveGoods: {
        grNumber: `GR-${Date.now()}`,
        poNumber: templateVars.poNumber || "PO-123",
        status: "RECEIVED",
        receivedAt: new Date().toISOString(),
      },
    };
  }

  // Generic fallback
  const camelCaseName = operationName.charAt(0).toLowerCase() + operationName.slice(1);
  return {
    [camelCaseName]: {
      id: `ID-${Date.now()}`,
      status: "SUCCESS",
      timestamp: new Date().toISOString(),
      ...templateVars,
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const graphqlTemplate = body?.graphqlTemplate?.toString?.().trim?.();
  const templateVarsRaw = body?.templateVars;
  const dsl = body?.dsl?.toString?.() || "";
  const query = body?.query?.toString?.() || "";

  if (!graphqlTemplate) {
    return NextResponse.json({ error: "graphqlTemplate 不能为空" }, { status: 400 });
  }

  const templateVars: TemplateVars =
    templateVarsRaw && typeof templateVarsRaw === "object"
      ? Object.fromEntries(
          Object.entries(templateVarsRaw).map(([key, value]) => [String(key), String(value ?? "")])
        )
      : {};

  const startedAt = Date.now();
  const { operationType, operationName } = extractOperationName(graphqlTemplate);
  const data = simulateGraphQLResult(operationName, templateVars);
  const latencyMs = Date.now() - startedAt;

  return NextResponse.json({
    success: true,
    receipt: {
      receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      endpoint: "mock://graphql/library-service",
      operationType,
      operationName,
      status: "SUCCESS",
      executedAt: new Date().toISOString(),
      latencyMs,
    },
    requestEcho: {
      query,
      dsl,
      templateVars,
    },
    data,
  });
}
