export type CasePlaybookStep = {
  stepId: string;
  title: string;
  intentText: string;
  actionId: string;
  inputExampleJson?: any;
  outputExampleJson?: any;
  relatedDatasetNames: string[];
  relatedRelationshipNames?: string[];
  relatedMetricNames?: string[];
  notes?: string;
};

export type CasePlaybook = {
  caseId: string;
  title: string;
  description: string;
  steps: CasePlaybookStep[];
};

export const CASE_PLAYBOOKS: CasePlaybook[] = [
  {
    caseId: "restaurant-expiring-inventory-to-membership-ops",
    title: "餐饮：临期原材料预警 → 会员运营消耗闭环",
    description:
      "当 Dashboard 发现原材料临期风险时：找临期批次→找Top会员→升级等级→推荐菜品→创建券→发券→创建套餐。",
    steps: [
      {
        stepId: "r1-step-1",
        title: "查临期最严重批次/原料",
        intentText: "查门店在指定时间点的临期最严重原材料批次与到期信息，并可进一步补全库存余额与原料名称。",
        actionId: "inventory_lots/query_most_expiring",
        relatedDatasetNames: ["inventory_lots", "inventory_lot_balances", "ingredients"],
        inputExampleJson: {
          as_of_time: "2026-04-18T10:00:00Z",
          expiry_within_days: 7,
          store_id: "S001",
          top_n: 20,
        },
        outputExampleJson: {
          lots: [
            { lot_id: "L1001", ingredient_id: "ING_EGG", expiry_date: "2026-04-19" },
            { lot_id: "L1002", ingredient_id: "ING_MILK", expiry_date: "2026-04-20" },
            { lot_id: "L1003", ingredient_id: "ING_PORK", expiry_date: "2026-04-22" },
          ],
        },
        notes: "可补全：join inventory_lot_balances 获取 on_hand_qty；join ingredients 获取名称。",
      },
      {
        stepId: "r1-step-2",
        title: "查去年积分 Top10 会员",
        intentText: "统计去年积分最高的Top10会员，用于后续运营动作（升级与发券）。",
        actionId: "customers/top_members_by_points",
        relatedDatasetNames: ["customers", "loyalty_point_ledger"],
        inputExampleJson: {
          date_range: { start: "2025-01-01T00:00:00Z", end: "2025-12-31T23:59:59Z" },
          top_n: 10,
          include_negative: false,
        },
        outputExampleJson: {
          top_members: [{ customer_id: "C001", points: 12380 }],
        },
      },
      {
        stepId: "r1-step-3",
        title: "升级 Top10 会员等级",
        intentText: "为Top会员升级等级，并记录原因与生效时间。",
        actionId: "customer_memberships/upgrade_tier",
        relatedDatasetNames: ["customer_memberships", "membership_tiers", "customers"],
        inputExampleJson: {
          customer_id: "C001",
          target_tier_id: "T2",
          effective_time: "2026-04-18T10:05:00Z",
          reason: "临期消耗运营：Top10积分会员升级",
        },
        outputExampleJson: { success: true },
      },
      {
        stepId: "r1-step-4",
        title: "推荐消耗临期原料最强的菜品",
        intentText: "根据临期原料、配方与销量，推荐最能消耗临期风险的菜品TopN，并给出解释。",
        actionId: "dishes/recommend_for_expiring_ingredients",
        relatedDatasetNames: ["dishes", "dish_recipe_items", "order_items", "inventory_lots"],
        inputExampleJson: {
          as_of_time: "2026-04-18T10:00:00Z",
          store_id: "S001",
          expiry_within_days: 7,
          lookback_days: 30,
          top_n: 5,
          strategy: "EXPECTED_USAGE_7D",
        },
        outputExampleJson: {
          recommended_dishes: [{ dish_id: "D001", score: 0.92 }],
        },
      },
      {
        stepId: "r1-step-5",
        title: "创建免费菜券模板",
        intentText: "创建一张免费菜券模板，绑定推荐菜品，并设置有效期与原因。",
        actionId: "coupons/create_free_dish_template",
        relatedDatasetNames: ["coupons", "dishes"],
        inputExampleJson: {
          coupon_code: "FREE_DISH_D001_20260418",
          free_dish_id: "D001",
          valid_from: "2026-04-18T10:10:00Z",
          valid_to: "2026-04-25T23:59:59Z",
          is_active: true,
          reason: "临期消耗运营：赠送蛋炒饭免费券",
        },
        outputExampleJson: { coupon_id: "CPN9001" },
      },
      {
        stepId: "r1-step-6",
        title: "给 Top10 发券",
        intentText: "给Top会员批量发放免费菜券，并记录原因。",
        actionId: "customer_coupons/issue_free_dish_coupon",
        relatedDatasetNames: ["customer_coupons", "customers", "coupons"],
        inputExampleJson: {
          customer_id: "C001",
          coupon_id: "CPN9001",
          issued_at: "2026-04-18T10:12:00Z",
          reason: "临期消耗运营：Top10会员赠券",
        },
        outputExampleJson: { success: true },
      },
      {
        stepId: "r1-step-7",
        title: "创建会员套餐并绑定券权益",
        intentText: "创建运营套餐，并将菜券作为权益绑定，设定最低消费门槛。",
        actionId: "membership_packages/create",
        relatedDatasetNames: ["membership_packages", "membership_package_benefits", "coupons"],
        inputExampleJson: {
          package_code: "PKG_EXPIRING_202604",
          package_name: "临期消耗关怀套餐（送蛋炒饭券）",
          price: 9.9,
          currency: "CNY",
          start_date: "2026-04-18T00:00:00Z",
          end_date: "2026-05-18T23:59:59Z",
        },
        outputExampleJson: { package_id: "PKG1001" },
      },
    ],
  },
  {
    caseId: "sap-p2p-shortage-to-two-pr-variants",
    title: "SAP P2P：缺料预警 → 交期/价格对比 → 两套请购方案",
    description:
      "当 Dashboard 发现物料缺失风险：分析PO→GR交期→推荐供应商（稳定/便宜）→生成两套PR草案。",
    steps: [
      {
        stepId: "p2p-step-1",
        title: "分析 PO→GR 交期（按供应商）",
        intentText: "基于历史PO与收货，计算同款物料的交期统计（min/max/median/p90与稳定性）并按供应商对比。",
        actionId: "purchase_orders/analyze_po_to_gr_lead_time",
        relatedDatasetNames: ["purchase_orders", "goods_receipt_items", "suppliers", "materials"],
        inputExampleJson: {
          material_id: "MAT_4711",
          plant_id: "PLANT_1000",
          lookback_receipts: 5,
          date_range: { start: "2025-10-01T00:00:00Z", end: "2026-04-18T00:00:00Z" },
          group_by: ["supplier_id"],
          stats: ["min_days", "max_days", "median_days", "p90_days", "stability_spread_days"],
        },
        outputExampleJson: {
          by_supplier: [{ supplier_id: "SUP_A", p90_days: 8, stability_spread_days: 1 }],
        },
      },
      {
        stepId: "p2p-step-2",
        title: "推荐供应商（稳定交期/最优价格）",
        intentText: "综合交期与价格口径，给出两套推荐：交期更稳与价格最优，并提示风险。",
        actionId: "purchasing_info_records/recommend_suppliers_for_material_shortage",
        relatedDatasetNames: ["purchasing_info_records", "purchase_orders", "goods_receipt_items", "suppliers", "materials"],
        inputExampleJson: {
          material_id: "MAT_4711",
          plant_id: "PLANT_1000",
          required_qty: 200,
          need_by_date: "2026-05-05T00:00:00Z",
          as_of_time: "2026-04-18T10:00:00Z",
          lookback_receipts: 5,
          lookback_days: 180,
          strategies: ["STABLE_ETA", "BEST_PRICE"],
          currency: "EUR",
        },
        outputExampleJson: {
          stable_eta: { supplier_id: "SUP_A", eta_p90_days: 8, unit_price: 10.5 },
          best_price: { supplier_id: "SUP_B", eta_p90_days: 19, unit_price: 9.8 },
        },
      },
      {
        stepId: "p2p-step-3",
        title: "生成两套 PR 草案（稳定版/便宜版）",
        intentText: "基于推荐结果生成两套请购草案，并用 explain 标注证据与风险。",
        actionId: "purchase_requisitions/create_two_variants_for_material_shortage",
        relatedDatasetNames: ["purchase_requisitions", "materials", "suppliers", "plants"],
        inputExampleJson: {
          company_code_id: "CC_1000",
          plant_id: "PLANT_1000",
          purchasing_org_id: "PORG_10",
          purchasing_group_id: "PGRP_01",
          material_id: "MAT_4711",
          quantity: 200,
          unit_of_measure: "EA",
          need_by_date: "2026-05-05T00:00:00Z",
          as_of_time: "2026-04-18T10:00:00Z",
          lookback_receipts: 5,
          lookback_days: 180,
          comment: "缺料预警触发：生成交期稳定版/价格最优版两套请购草案",
        },
        outputExampleJson: {
          variants: [{ variant: "STABLE_ETA", purchase_requisition_id: "PR_9001" }],
        },
      },
    ],
  },
];

