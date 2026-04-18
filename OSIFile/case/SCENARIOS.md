# 场景剧本（Restaurant & SAP P2P）

本文档基于两份 OSI YAML 语义本体模型，构建两个可执行的“Dashboard → 发现 → 分析 → 决策 → 执行 → 复盘”案例，并**假设一组示例数据**用于讲清楚端到端链路。

- 餐饮模型（Restaurant）：`zh/food_semantic_model_semantic_v2.yaml`（内部 `semantic_model.name` 为 `restaurant_management_model_semantic_v3`）
- PP / P2P 模型（SAP P2P）：`zh/pp_semantic_model_semantic_v3.yaml`（内部 `semantic_model.name` 为 `sap_p2p_procurement_ontology_model_v3`）

> 注：案例中的“动作调用”（action_types）为本体模型内 `custom_extensions.action_types` 的语义接口。实际落地时可映射到 SQL / API / 工作流引擎。

---

## 场景 1：餐饮（临期原材料预警 → 会员运营消耗闭环）

### 1.1 业务目标
当 Dashboard 监控到“原材料临期风险”时，系统支持用户一键完成：
1) 找出当前仓库临期最严重的原材料（含批次、到期天数、现存量）  
2) 找出去年积分最多 Top10 会员  
3) 升级这批会员等级  
4) 推荐“最能消耗临期原料”的菜品  
5) 创建免费菜券模板并给 Top10 发券  
6) 创建会员套餐：设置“最低消费≈赠送菜品基本成本”即可使用送菜券

### 1.2 假设数据（示例）

#### A) 库存批次（inventory_lots）与批次余额（inventory_lot_balances）
假设门店/仓库：`store_id = S001`，分析时点：`2026-04-18T10:00:00Z`，临期阈值：7 天。

| lot_id | ingredient_id | expiry_date | on_hand_qty(快照) | 备注 |
|---|---|---:|---:|---|
| L1001 | ING_EGG | 2026-04-19 | 120 | 鸡蛋，1 天到期，量大 |
| L1002 | ING_MILK | 2026-04-20 | 30 | 牛奶，2 天到期 |
| L1003 | ING_PORK | 2026-04-22 | 50 | 猪肉，4 天到期 |

#### B) 配方（dish_recipe_items）
| dish_id | dish_name | ingredient_id | qty_per_dish | unit |
|---|---|---|---:|---|
| D001 | 蛋炒饭 | ING_EGG | 2 | pcs |
| D001 | 蛋炒饭 | ING_RICE | 0.2 | kg |
| D002 | 叉烧饭 | ING_PORK | 0.15 | kg |
| D003 | 鲜奶布丁 | ING_MILK | 0.3 | L |

#### C) 近 7 天销量（order_items 聚合）
| dish_id | 近7天销量（份） |
|---|---:|
| D001 | 260 |
| D002 | 40 |
| D003 | 25 |

#### D) 会员积分流水（loyalty_point_ledger 聚合得到 Top10）
假设“去年”（2025-01-01 ~ 2025-12-31）积分 Top10：

| rank | customer_id | points_earned |
|---:|---|---:|
| 1 | C001 | 12,380 |
| 2 | C002 | 11,945 |
| … | … | … |
| 10 | C010 | 7,210 |

#### E) 会员等级（membership_tiers）与会员关系（customer_memberships）
假设等级：Silver → Gold → Platinum（这里只示意）。

| tier_id | tier_code | tier_name |
|---|---|---|
| T1 | SILVER | 白银 |
| T2 | GOLD | 黄金 |
| T3 | PLATINUM | 铂金 |

Top10 当前均为 `T1`，计划升级到 `T2`。

---

### 1.3 意图处理（推荐的执行编排）

#### Step 1：查“临期最严重批次/原料”
动作：`inventory_lots/query_most_expiring`

输入（示例）：
```json
{
  "as_of_time": "2026-04-18T10:00:00Z",
  "expiry_within_days": 7,
  "store_id": "S001",
  "top_n": 20
}
```

输出（示例，简化）：
```json
{
  "lots": [
    {"lot_id":"L1001","ingredient_id":"ING_EGG","expiry_date":"2026-04-19"},
    {"lot_id":"L1002","ingredient_id":"ING_MILK","expiry_date":"2026-04-20"},
    {"lot_id":"L1003","ingredient_id":"ING_PORK","expiry_date":"2026-04-22"}
  ]
}
```

补全：再 join `inventory_lot_balances` 得到 `on_hand_qty`；join `ingredients` 得到名称。

#### Step 2：查“去年积分 Top10 会员”
动作：`customers/top_members_by_points`

输入（示例）：
```json
{
  "date_range": {"start":"2025-01-01T00:00:00Z","end":"2025-12-31T23:59:59Z"},
  "top_n": 10,
  "include_negative": false
}
```

输出（示例）：
```json
{"top_members":[{"customer_id":"C001","points":12380}, {"customer_id":"C002","points":11945}, "..."]}
```

#### Step 3：升级会员等级（Top10）
动作：`customer_memberships/upgrade_tier`

对每个 customer 执行一次（或在实现层批量化）：
```json
{
  "customer_id": "C001",
  "target_tier_id": "T2",
  "effective_time": "2026-04-18T10:05:00Z",
  "reason": "临期消耗运营：Top10积分会员升级"
}
```

#### Step 4：推荐“消耗临期原料最强”的菜品 TopN
动作：`dishes/recommend_for_expiring_ingredients`

输入（示例）：
```json
{
  "as_of_time": "2026-04-18T10:00:00Z",
  "store_id": "S001",
  "expiry_within_days": 7,
  "lookback_days": 30,
  "top_n": 5,
  "strategy": "EXPECTED_USAGE_7D"
}
```

示例解释（按“销量×配方×临期库存”粗略估算）：
- 蛋炒饭 D001：近7天 260 份 × 每份 2 个蛋 ⇒ 预计消耗 520 个蛋（可有效消耗 ING_EGG 的临期风险）
- 鲜奶布丁 D003：25 份 × 0.3L ⇒ 7.5L 牛奶（对 ING_MILK 消耗较弱）

输出（示例）：
```json
{
  "recommended_dishes": [
    {"dish_id":"D001","score":0.92,"explain":"命中临期原料: ING_EGG；预计7天消耗=520pcs"},
    {"dish_id":"D003","score":0.21,"explain":"命中临期原料: ING_MILK；预计7天消耗=7.5L"}
  ]
}
```

#### Step 5：创建免费菜券模板（绑定推荐菜品）
动作：`coupons/create_free_dish_template`

输入（示例）：
```json
{
  "coupon_code": "FREE_DISH_D001_20260418",
  "free_dish_id": "D001",
  "valid_from": "2026-04-18T10:10:00Z",
  "valid_to": "2026-04-25T23:59:59Z",
  "is_active": true,
  "reason": "临期消耗运营：赠送蛋炒饭免费券"
}
```

输出（示例）：
```json
{"coupon_id":"CPN9001"}
```

#### Step 6：给 Top10 发券
动作：`customer_coupons/issue_free_dish_coupon`

对 Top10 每人执行：
```json
{
  "customer_id": "C001",
  "coupon_id": "CPN9001",
  "issued_at": "2026-04-18T10:12:00Z",
  "reason": "临期消耗运营：Top10会员赠券"
}
```

#### Step 7：创建会员套餐 + 绑定券权益（最低消费≈基本成本）
动作 1：`membership_packages/create`
```json
{
  "package_code": "PKG_EXPIRING_202604",
  "package_name": "临期消耗关怀套餐（送蛋炒饭券）",
  "price": 9.9,
  "currency": "CNY",
  "start_date": "2026-04-18T00:00:00Z",
  "end_date": "2026-05-18T23:59:59Z"
}
```
输出（示例）：
```json
{"package_id":"PKG1001"}
```

动作 2：`membership_package_benefits/add_coupon_benefit`

假设蛋炒饭的“基本成本”约为 6.5 元（来自 dish_theoretical_unit_cost 的口径计算/或业务给定）：
```json
{
  "package_id": "PKG1001",
  "coupon_id": "CPN9001",
  "min_spend_amount": 6.5,
  "benefit_type": "COUPON",
  "reason": "最低消费达到基本成本即可使用送菜券"
}
```

---

### 1.4 复盘输出（建议 Dashboard/助手给用户展示）
- 临期 Top 原料（含批次/数量/到期天数/风险评分）
- 推荐菜品（为何能消耗、预计消耗量）
- Top10 会员列表与升级结果
- 券模板信息与发券成功/失败清单
- 套餐创建与权益绑定结果

---

## 场景 2：SAP P2P（缺料预警 → 交期/价格对比 → 两套请购方案）

### 2.1 业务目标
当 Dashboard 监控到“物料即将缺失”时，系统支持：
1) 基于最近批次（历史 PO→GR）统计同款物料的**最快/最慢到货时间**与**交期稳定性**（按供应商对比）  
2) 对比供应商价格（优先 info record，有效期内；缺失则回退历史成交价）  
3) 自动生成两套方案：  
   - A：到货时间更稳定（STABLE_ETA）  
   - B：供货价最优惠（BEST_PRICE）  

### 2.2 假设数据（示例）

#### A) 触发：缺料预警
- `material_id = MAT_4711`（同款物料）
- `plant_id = PLANT_1000`
- `required_qty = 200`
- `need_by_date = 2026-05-05T00:00:00Z`

#### B) 最近 5 次收货样本（用 PO.created_date 与 GR.posting_date 计算）
| sample | supplier_id | PO.created_date | GR.posting_date | lead_time_days |
|---:|---|---|---|---:|
| 1 | SUP_A | 2026-03-01 | 2026-03-08 | 7 |
| 2 | SUP_A | 2026-03-20 | 2026-03-28 | 8 |
| 3 | SUP_A | 2026-04-02 | 2026-04-10 | 8 |
| 4 | SUP_B | 2026-03-05 | 2026-03-18 | 13 |
| 5 | SUP_B | 2026-04-01 | 2026-04-20 | 19 |

由此可得：
- SUP_A：交期稳定（7~8 天），p90 约 8 天
- SUP_B：交期波动大（13~19 天），p90 约 19 天

#### C) 价格（优先采购信息记录 purchasing_info_records）
| supplier_id | info_record 价格（净价） | currency | valid_to |
|---|---:|---|---|
| SUP_A | 10.50 | EUR | 2026-12-31 |
| SUP_B | 9.80 | EUR | 2026-12-31 |

结论：
- 稳定交期：SUP_A 更优
- 最优价格：SUP_B 更优

---

### 2.3 意图处理（推荐的执行编排）

#### Step 1：分析 PO→GR 交期（最快/最慢/稳定性）
动作：`purchase_orders/analyze_po_to_gr_lead_time`

输入（示例）：
```json
{
  "material_id": "MAT_4711",
  "plant_id": "PLANT_1000",
  "lookback_receipts": 5,
  "date_range": {"start":"2025-10-01T00:00:00Z","end":"2026-04-18T00:00:00Z"},
  "group_by": ["supplier_id"],
  "stats": ["min_days","max_days","median_days","p90_days","stability_spread_days"]
}
```

输出（示例）：
```json
{
  "by_supplier": [
    {"supplier_id":"SUP_A","min_days":7,"max_days":8,"median_days":8,"p90_days":8,"stability_spread_days":1},
    {"supplier_id":"SUP_B","min_days":13,"max_days":19,"median_days":16,"p90_days":19,"stability_spread_days":6}
  ]
}
```

#### Step 2：推荐供应商（交期稳定版/价格最优版）
动作：`purchasing_info_records/recommend_suppliers_for_material_shortage`

输入（示例）：
```json
{
  "material_id": "MAT_4711",
  "plant_id": "PLANT_1000",
  "required_qty": 200,
  "need_by_date": "2026-05-05T00:00:00Z",
  "as_of_time": "2026-04-18T10:00:00Z",
  "lookback_receipts": 5,
  "lookback_days": 180,
  "strategies": ["STABLE_ETA","BEST_PRICE"],
  "currency": "EUR"
}
```

输出（示例）：
```json
{
  "stable_eta": {
    "supplier_id": "SUP_A",
    "eta_p90_days": 8,
    "unit_price": 10.50,
    "currency": "EUR",
    "explain": "交期稳定性最佳（spread=1天），p90≈8天"
  },
  "best_price": {
    "supplier_id": "SUP_B",
    "eta_p90_days": 19,
    "unit_price": 9.80,
    "currency": "EUR",
    "explain": "价格最优（有效info record），但交期波动较大"
  }
}
```

#### Step 3：生成两套 PR 草案（稳定版/便宜版）
动作：`purchase_requisitions/create_two_variants_for_material_shortage`

输入（示例）：
```json
{
  "company_code_id": "CC_1000",
  "plant_id": "PLANT_1000",
  "purchasing_org_id": "PORG_10",
  "purchasing_group_id": "PGRP_01",
  "material_id": "MAT_4711",
  "quantity": 200,
  "unit_of_measure": "EA",
  "need_by_date": "2026-05-05T00:00:00Z",
  "as_of_time": "2026-04-18T10:00:00Z",
  "lookback_receipts": 5,
  "lookback_days": 180,
  "comment": "缺料预警触发：生成交期稳定版/价格最优版两套请购草案"
}
```

输出（示例）：
```json
{
  "variants": [
    {
      "variant": "STABLE_ETA",
      "purchase_requisition_id": "PR_9001",
      "supplier_id": "SUP_A",
      "requested_delivery_date": "2026-04-26T00:00:00Z",
      "unit_price": 10.50,
      "currency": "EUR"
    },
    {
      "variant": "BEST_PRICE",
      "purchase_requisition_id": "PR_9002",
      "supplier_id": "SUP_B",
      "requested_delivery_date": "2026-05-07T00:00:00Z",
      "unit_price": 9.80,
      "currency": "EUR"
    }
  ]
}
```

> 备注：requested_delivery_date 的计算可采用 `as_of_time + p90_days`（更保守）或 `as_of_time + median_days`（更激进），并受 `need_by_date` 约束。若 BEST_PRICE 的交期风险超过 need_by_date，可在 explain 中提示风险或要求人工确认。

---

### 2.4 复盘输出（建议 Dashboard/助手给用户展示）
- 同款物料最近 N 次交期：最快/最慢/p90/稳定性 spread（按供应商对比）
- 价格对比：info record vs 历史成交价（含口径说明与币种）
- 两套 PR 草案：供应商、交期、价格、风险提示、可追溯证据（PO/GR 样本）

