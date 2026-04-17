Ontology Components
┌─────────────────────────────────────┐
│         React Components            │
│  ┌─────────────┐  ┌─────────────┐  │
│  │ OntologyGraph│  │  ClassDetail │  │
│  │ (React Flow)│  │   Panel      │  │
│  └─────────────┘  └─────────────┘  │
├─────────────────────────────────────┤
│           State Management          │
│        (Zustand / Redux)          │
│   - 当前选中的类、展开状态、过滤条件   │
├─────────────────────────────────────┤
│         RDF Processing              │
│   (rdflib.js / jsonld / OWL-API)  │
│   - 解析 OWL/RDF，提取类、属性、关系  │
├─────────────────────────────────────┤
│         Data Source                 │
│   - SPARQL Endpoint (Fuseki/GraphDB)│
│   - 静态 TTL/OWL 文件               │
└─────────────────────────────────────┘


```ts
ObjectType: Person
Description: "独立于任何雇佣关系的自然人身份，终身唯一实体"

Properties:
  personId: UUID                  # 全局唯一主键，永不变化（推荐使用 ULID 或 UUIDv7 以便排序）
  nationalId: String @sensitive   # 身份证号/护照号等，强加密存储 + 访问控制
  fullName: String @temporal      # 支持姓名变更历史（结婚、改名等）
  birthDate: Date                 # 出生日期（不可变更）
  
  contactInfo:
    email: String @temporal       # 支持邮箱变更历史
    phone: String @temporal       # 支持手机号变更历史
    # 可扩展：wechat, telegram, address 等其他联系方式

  # 时态属性（Temporal / Bitemporal 可选）
  employmentStatus: Enum[Prospect, Active, Suspended, Terminated] @temporal
  # 示例：
  # [
  #   {value: "Prospect",   validFrom: "2026-03-01", validTo: "2026-03-15"},
  #   {value: "Active",     validFrom: "2026-03-15", validTo: null}
  # ]

  # 其他常用时态属性（建议补充）：
  legalStatus: Enum[Citizen, Resident, Foreigner] @temporal
  dataConsent: Enum[Granted, Withdrawn, Expired] @temporal   # 隐私同意状态
```