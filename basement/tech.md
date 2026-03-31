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
