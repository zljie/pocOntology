// ============================================
// Palantir 风格本体设计模拟器 - 类型定义
// 支持三层本体架构：语义层、动势层、动态层
// ============================================

// Property Base Types
export type PropertyBaseType = 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'TIMESTAMP' | 'STRUCT';

// Property Visibility
export type PropertyVisibility = 'NORMAL' | 'PROMINENT' | 'HIDDEN';

// ============================================
// 【三层本体架构】定义
// ============================================

/**
 * 本体层类型枚举
 * - SEMANTIC: 语义层 - 世界是什么（实体和关系）
 * - KINETIC: 动势层 - 世界如何变化（操作和数据流）
 * - DYNAMIC: 动态层 - 世界如何决策（规则和AI模型）
 */
export type OntologyLayer = 'SEMANTIC' | 'KINETIC' | 'DYNAMIC';

/**
 * 本体层描述
 */
export const ONTOLOGY_LAYER_INFO: Record<OntologyLayer, {
  label: string;
  labelZh: string;
  description: string;
  color: string;
  icon: string;
}> = {
  SEMANTIC: {
    label: 'Semantic Layer',
    labelZh: '语义层',
    description: '世界是什么 - 定义实体类型和关系类型',
    color: '#3B82F6', // 蓝色
    icon: 'Database',
  },
  KINETIC: {
    label: 'Kinetic Layer',
    labelZh: '动势层',
    description: '世界如何变化 - 定义操作类型和数据流',
    color: '#10B981', // 绿色
    icon: 'Zap',
  },
  DYNAMIC: {
    label: 'Dynamic Layer',
    labelZh: '动态层',
    description: '世界如何决策 - 定义业务规则和AI模型',
    color: '#F59E0B', // 橙色
    icon: 'Brain',
  },
};

// ============================================
// 语义层类型 (Semantic Layer)
// ============================================

// Struct Property Field
export interface StructField {
  id: string;
  fieldName: string;
  fieldType: PropertyBaseType;
  required: boolean;
}

// Property Definition
export interface Property {
  id: string;
  apiName: string;
  displayName: string;
  baseType: PropertyBaseType;
  visibility: PropertyVisibility;
  required: boolean;
  defaultValue?: string;
  description?: string;
  // For STRING type
  maxLength?: number;
  // For INTEGER/DOUBLE type
  minValue?: number;
  maxValue?: number;
  // For STRUCT type
  structFields?: StructField[];
  // For vector space mapping
  isSemanticSearch?: boolean;
}

/**
 * 语义层 - 实体类型 (Object Type)
 * 代表业务领域中的核心实体
 */
export interface ObjectType {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  primaryKey: string; // Property ID
  titleKey: string;   // Property ID for display name
  properties: Property[];
  icon?: string;
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  // 三层架构
  layer: OntologyLayer;
  // 语义层特定
  category?: 'MASTER_DATA' | 'TRANSACTION' | 'REFERENCE' | 'SYSTEM'; // 实体分类
  createdAt: string;
  updatedAt: string;
}

/**
 * 链接基数类型
 */
export type Cardinality = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

/**
 * 语义层 - 关系类型 (Link Type)
 * 代表实体之间的语义关联
 */
export interface LinkType {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  sourceTypeId: string;
  targetTypeId: string;
  cardinality: Cardinality;
  foreignKeyPropertyId: string; // Property ID in source type
  inverseLinkName?: string; // Name from target to source
  properties: Property[]; // Link properties
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  // 三层架构
  layer: OntologyLayer;
  // 语义层特定
  relationshipType?: 'ASSOCIATION' | 'COMPOSITION' | 'INHERITANCE' | 'REFERENCE';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 动势层类型 (Kinetic Layer)
// ============================================

/**
 * 动势层 - 操作类型 (Action Type)
 * 代表业务流程中的原子操作
 */
export interface ActionType {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 操作影响的实体类型
  affectedObjectTypeIds: string[];
  affectedLinkTypeIds: string[];
  // 输入参数
  inputParameters: Property[];
  // 输出结果
  outputProperties: Property[];
  // 触发条件
  triggerConditions?: {
    condition: string;
    description: string;
  }[];
  // 前置动作
  preActions?: string[]; // ActionType IDs
  // 后置动作
  postActions?: string[]; // ActionType IDs
  // 权限要求
  requiredRoles?: string[];
  // 图标和颜色
  icon?: string;
  color?: string;
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

/**
 * 动势层 - 数据流 (Data Flow)
 * 代表业务流程中的数据流转路径
 */
export interface DataFlow {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 数据流步骤
  steps: {
    stepOrder: number;
    stepName: string;
    actionTypeId?: string; // 关联的操作类型
    objectTypeId?: string; // 涉及的实体
    transformation?: string; // 数据转换规则
    validation?: string; // 验证规则
  }[];
  // 流向
  flowDirection: 'FORWARD' | 'BACKWARD' | 'BIDIRECTIONAL';
  // 状态机关联
  stateMachineId?: string;
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

/**
 * 业务事件类型
 */
export interface BusinessEvent {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 触发的事件类型
  eventType: 'ENTITY_CREATED' | 'ENTITY_UPDATED' | 'ENTITY_DELETED' | 
             'LINK_CREATED' | 'LINK_DELETED' | 'ACTION_TRIGGERED' | 'CONDITION_MET';
  // 关联的实体/操作
  sourceObjectTypeId?: string;
  sourceActionTypeId?: string;
  // 事件属性
  eventProperties: Property[];
  // 监听器/处理器
  handlers?: {
    handlerType: 'NOTIFICATION' | 'WEBHOOK' | 'AUTOMATION' | 'AUDIT';
    handlerConfig: Record<string, unknown>;
  }[];
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 动态层类型 (Dynamic Layer)
// ============================================

/**
 * 动态层 - 业务规则 (Business Rule)
 * 代表业务决策逻辑和约束
 */
export interface BusinessRule {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 规则类型
  ruleType: 'CONSTRAINT' | 'VALIDATION' | 'DERIVATION' | 'CALCULATION' | 'ENRICHMENT';
  // 规则表达式
  expression?: string; // DSL 或自然语言描述
  // 规则影响的实体
  appliesToObjectTypeIds: string[];
  appliesToActionTypeIds?: string[];
  // 违反处理
  onViolation?: {
    action: 'BLOCK' | 'WARN' | 'LOG' | 'OVERRIDE';
    message: string;
  };
  // 优先级
  priority: number; // 1-100, 越高越优先
  // 是否启用
  enabled: boolean;
  // 条件激活
  activationConditions?: {
    condition: string;
    description: string;
  }[];
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

/**
 * 动态层 - AI模型 (AI Model)
 * 代表智能决策和推荐能力
 */
export interface AIModel {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 模型类型
  modelType: 'RECOMMENDATION' | 'PREDICTION' | 'CLASSIFICATION' | 'CLUSTERING' | 'NLP' | 'CUSTOM';
  // 输入特征
  inputFeatures: {
    objectTypeId: string;
    propertyIds: string[];
    featureDescription?: string;
  }[];
  // 输出
  outputType: 'SCORE' | 'RANKING' | 'CLASSIFICATION' | 'PREDICTION' | 'EMBEDDING';
  outputDescription?: string;
  // 模型配置
  modelConfig?: {
    algorithm?: string;
    threshold?: number;
    topK?: number;
    [key: string]: unknown;
  };
  // 训练数据
  trainingData?: {
    objectTypeId: string;
    dateRange?: { start: string; end: string };
    sampleSize?: number;
  };
  // 评估指标
  metrics?: {
    metricName: string;
    metricValue: number;
  }[];
  // 模型来源
  modelSource: 'BUILT_IN' | 'CUSTOM_TRAINED' | 'EXTERNAL_API';
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

/**
 * 动态层 - 分析洞察 (Analysis Insight)
 * 代表预构建的分析报表和洞察
 */
export interface AnalysisInsight {
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  // 洞察类型
  insightType: 'DASHBOARD' | 'METRIC' | 'TREND' | 'ANOMALY' | 'FORECAST' | 'CORRELATION';
  // 数据源
  dataSources: {
    objectTypeId: string;
    propertyIds: string[];
    aggregation?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT';
  }[];
  // 可视化配置
  visualization?: {
    chartType: 'BAR' | 'LINE' | 'PIE' | 'SCATTER' | 'HEATMAP' | 'TABLE';
    dimensions?: string[];
    measures?: string[];
  };
  // 刷新频率
  refreshFrequency?: 'REAL_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  // 过滤条件
  filters?: {
    objectTypeId: string;
    propertyId: string;
    operator: string;
    value: string;
  }[];
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 提案系统 (Proposal System)
// ============================================

// Proposal Status
export type ProposalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

// Change Types
export type ChangeType = 'CREATE' | 'UPDATE' | 'DELETE';

// Entity Type - 扩展支持三层架构
export type EntityType = 'OBJECT_TYPE' | 'LINK_TYPE' | 'ACTION_TYPE' | 'DATA_FLOW' | 
                         'BUSINESS_RULE' | 'AI_MODEL' | 'ANALYSIS_INSIGHT' | 'PROPERTY';

// Change Record
export interface ChangeRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  changeType: ChangeType;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  field?: string;
}

// Proposal
export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  changes: ChangeRecord[];
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

// ============================================
// UI State
// ============================================

// Selection State
export interface SelectionState {
  selectedObjectTypeId: string | null;
  selectedLinkTypeId: string | null;
  selectedPropertyId: string | null;
  selectedLayer: OntologyLayer | 'ALL';
}

// UI State
export interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  canvasZoom: number;
  canvasPosition: { x: number; y: number };
  showMinimap: boolean;
  showGrid: boolean;
  theme: 'dark' | 'light';
}

// Ontology State (Main Store)
export interface OntologyState {
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  actionTypes: ActionType[];
  dataFlows: DataFlow[];
  businessRules: BusinessRule[];
  aiModels: AIModel[];
  analysisInsights: AnalysisInsight[];
  proposals: Proposal[];
  isLoading: boolean;
  lastSaved: string | null;
}

// ============================================
// React Flow 节点/边
// ============================================

export interface ObjectTypeNode {
  id: string;
  type: 'objectType';
  position: { x: number; y: number };
  data: {
    objectType: ObjectType;
    label: string;
  };
}

export interface LinkTypeEdge {
  id: string;
  source: string;
  target: string;
  type: 'linkType';
  data: {
    linkType: LinkType;
    cardinality: Cardinality;
    label: string;
  };
}

// ============================================
// Helper types for form inputs
// ============================================

export interface CreateObjectTypeInput {
  apiName: string;
  displayName: string;
  description?: string;
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  category?: 'MASTER_DATA' | 'TRANSACTION' | 'REFERENCE' | 'SYSTEM';
}

export interface CreateLinkTypeInput {
  apiName: string;
  displayName: string;
  description?: string;
  sourceTypeId: string;
  targetTypeId: string;
  cardinality: Cardinality;
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
  layer: OntologyLayer;
  relationshipType?: 'ASSOCIATION' | 'COMPOSITION' | 'INHERITANCE' | 'REFERENCE';
}

export interface CreateActionTypeInput {
  apiName: string;
  displayName: string;
  description?: string;
  affectedObjectTypeIds: string[];
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
}

export interface CreateBusinessRuleInput {
  apiName: string;
  displayName: string;
  description?: string;
  ruleType: 'CONSTRAINT' | 'VALIDATION' | 'DERIVATION' | 'CALCULATION' | 'ENRICHMENT';
  appliesToObjectTypeIds: string[];
  visibility: 'PRIVATE' | 'PROJECT' | 'GLOBAL';
}

// Validation Error
export interface ValidationError {
  field: string;
  message: string;
}

// Import/Export
export interface OntologyExport {
  version: string;
  exportedAt: string;
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  actionTypes: ActionType[];
  dataFlows: DataFlow[];
  businessRules: BusinessRule[];
  aiModels: AIModel[];
  analysisInsights: AnalysisInsight[];
}

// ============================================
// 【图书馆管理系统】三层本体模型示例数据
// 基于 Palantir Ontology 设计
// ============================================

// ----------------------------------------
// 第一部分：语义层 (Semantic Layer)
// 世界是什么 - 定义实体和关系
// ----------------------------------------

export const SAMPLE_OBJECT_TYPES: ObjectType[] = [
  // ===== 语义层 - 读者域 =====
  {
    id: 'patron-001',
    apiName: 'Patron',
    displayName: '读者',
    description: '图书馆读者/用户，支持多类型（本科生/研究生/教师/访客）',
    primaryKey: 'patronId',
    titleKey: 'patronName',
    visibility: 'GLOBAL',
    icon: 'User',
    layer: 'SEMANTIC',
    category: 'MASTER_DATA',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'patronId', apiName: 'patronId', displayName: '读者ID', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: '唯一标识符（学号/工号）' },
      { id: 'patronName', apiName: 'patronName', displayName: '姓名', baseType: 'STRING', visibility: 'PROMINENT', required: true, maxLength: 100 },
      { id: 'patronType', apiName: 'patronType', displayName: '读者类型', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'UNDERGRAD/GRAD/FACULTY/STAFF/VISITOR' },
      { id: 'email', apiName: 'email', displayName: '邮箱', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'phone', apiName: 'phone', displayName: '联系电话', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'maxBooksAllowed', apiName: 'maxBooksAllowed', displayName: '最大借阅数', baseType: 'INTEGER', visibility: 'NORMAL', required: true, minValue: 0 },
      { id: 'outstandingFines', apiName: 'outstandingFines', displayName: '欠款金额', baseType: 'DOUBLE', visibility: 'NORMAL', required: true, defaultValue: '0' },
      { id: 'registrationDate', apiName: 'registrationDate', displayName: '注册日期', baseType: 'TIMESTAMP', visibility: 'HIDDEN', required: true },
      { id: 'accountStatus', apiName: 'accountStatus', displayName: '账户状态', baseType: 'STRING', visibility: 'NORMAL', required: true, description: 'ACTIVE/FROZEN/CLOSED' },
    ],
  },

  // ===== 语义层 - 图书域 =====
  {
    id: 'book-001',
    apiName: 'Book',
    displayName: '图书',
    description: '图书元数据（ISBN、作者、主题等），与馆藏副本分离',
    primaryKey: 'isbn',
    titleKey: 'title',
    visibility: 'GLOBAL',
    icon: 'BookOpen',
    layer: 'SEMANTIC',
    category: 'MASTER_DATA',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'isbn', apiName: 'isbn', displayName: 'ISBN', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: '国际标准书号' },
      { id: 'title', apiName: 'title', displayName: '书名', baseType: 'STRING', visibility: 'PROMINENT', required: true, maxLength: 500 },
      { id: 'subtitle', apiName: 'subtitle', displayName: '副标题', baseType: 'STRING', visibility: 'NORMAL', required: false, maxLength: 300 },
      { id: 'authors', apiName: 'authors', displayName: '作者', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: '逗号分隔的作者列表' },
      { id: 'publisher', apiName: 'publisher', displayName: '出版社', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'publicationYear', apiName: 'publicationYear', displayName: '出版年份', baseType: 'INTEGER', visibility: 'NORMAL', required: true },
      { id: 'subjects', apiName: 'subjects', displayName: '主题词', baseType: 'STRING', visibility: 'NORMAL', required: false, description: '逗号分隔的中图分类或主题词' },
      { id: 'language', apiName: 'language', displayName: '语言', baseType: 'STRING', visibility: 'NORMAL', required: true, defaultValue: 'zh-CN' },
      { id: 'pageCount', apiName: 'pageCount', displayName: '页数', baseType: 'INTEGER', visibility: 'NORMAL', required: false, minValue: 1 },
      { id: 'summary', apiName: 'summary', displayName: '摘要', baseType: 'STRING', visibility: 'NORMAL', required: false, description: '内容简介' },
    ],
  },

  // ===== 语义层 - 馆藏域 =====
  {
    id: 'holding-001',
    apiName: 'Holding',
    displayName: '馆藏副本',
    description: '图书馆实物馆藏，关联图书元数据与物理位置',
    primaryKey: 'barcode',
    titleKey: 'callNumber',
    visibility: 'GLOBAL',
    icon: 'MapPin',
    layer: 'SEMANTIC',
    category: 'TRANSACTION',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'barcode', apiName: 'barcode', displayName: '条码号', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: '馆藏唯一条码' },
      { id: 'callNumber', apiName: 'callNumber', displayName: '索书号', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: '排架用分类号码' },
      { id: 'shelfLocation', apiName: 'shelfLocation', displayName: '书架位置', baseType: 'STRING', visibility: 'NORMAL', required: true, description: '如: 文学库-A-3-15' },
      { id: 'copyNumber', apiName: 'copyNumber', displayName: '副本号', baseType: 'INTEGER', visibility: 'NORMAL', required: true, minValue: 1 },
      { id: 'condition', apiName: 'condition', displayName: '物理状况', baseType: 'STRING', visibility: 'NORMAL', required: true, description: 'NEW/GOOD/FAIR/POOR/DAMAGED' },
      { id: 'acquisitionDate', apiName: 'acquisitionDate', displayName: '入藏日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'price', apiName: 'price', displayName: '采购价格', baseType: 'DOUBLE', visibility: 'NORMAL', required: true, minValue: 0 },
      { id: 'status', apiName: 'status', displayName: '馆藏状态', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'AVAILABLE/LOANED/RESERVED/OVERDUE/LOST/WITHDRAWN/PROCESSING' },
    ],
  },

  // ===== 语义层 - 借阅记录域 =====
  {
    id: 'loan-001',
    apiName: 'Loan',
    displayName: '借阅记录',
    description: '读者借阅馆藏的完整生命周期记录',
    primaryKey: 'loanId',
    titleKey: 'loanId',
    visibility: 'GLOBAL',
    icon: 'ClipboardList',
    layer: 'SEMANTIC',
    category: 'TRANSACTION',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'loanId', apiName: 'loanId', displayName: '借阅ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'checkoutDate', apiName: 'checkoutDate', displayName: '借出日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
      { id: 'dueDate', apiName: 'dueDate', displayName: '应还日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
      { id: 'returnDate', apiName: 'returnDate', displayName: '实际归还日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: false },
      { id: 'renewalCount', apiName: 'renewalCount', displayName: '续借次数', baseType: 'INTEGER', visibility: 'NORMAL', required: true, defaultValue: '0', minValue: 0 },
      { id: 'fineAccrued', apiName: 'fineAccrued', displayName: '累计罚款', baseType: 'DOUBLE', visibility: 'NORMAL', required: true, defaultValue: '0', minValue: 0 },
      { id: 'purpose', apiName: 'purpose', displayName: '借阅目的', baseType: 'STRING', visibility: 'NORMAL', required: false, description: '学习/研究/教学参考/休闲阅读' },
      { id: 'loanStatus', apiName: 'loanStatus', displayName: '借阅状态', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'ACTIVE/RETURNED/OVERDUE/LOST' },
    ],
  },

  // ===== 语义层 - 预约域 =====
  {
    id: 'reservation-001',
    apiName: 'Reservation',
    displayName: '预约',
    description: '读者对馆藏的预约请求，支持等待队列',
    primaryKey: 'reservationId',
    titleKey: 'reservationId',
    visibility: 'GLOBAL',
    icon: 'CalendarClock',
    layer: 'SEMANTIC',
    category: 'TRANSACTION',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'reservationId', apiName: 'reservationId', displayName: '预约ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'reservationDate', apiName: 'reservationDate', displayName: '预约日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
      { id: 'expirationDate', apiName: 'expirationDate', displayName: '过期日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'pickupExpiry', apiName: 'pickupExpiry', displayName: '取书截止', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'queuePosition', apiName: 'queuePosition', displayName: '队列位置', baseType: 'INTEGER', visibility: 'NORMAL', required: true, minValue: 1 },
      { id: 'priority', apiName: 'priority', displayName: '优先级', baseType: 'INTEGER', visibility: 'NORMAL', required: true, defaultValue: '2', description: '1=教师/2=研究生/3=本科生' },
      { id: 'status', apiName: 'status', displayName: '预约状态', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'ACTIVE/PENDING_NOTIFICATION/EXPIRED/CANCELLED/FULFILLED' },
      { id: 'notificationSent', apiName: 'notificationSent', displayName: '已发送通知', baseType: 'BOOLEAN', visibility: 'HIDDEN', required: true, defaultValue: 'false' },
    ],
  },

  // ===== 语义层 - 供应商域 =====
  {
    id: 'supplier-001',
    apiName: 'Supplier',
    displayName: '供应商',
    description: '图书供应商/出版商信息',
    primaryKey: 'supplierId',
    titleKey: 'supplierName',
    visibility: 'GLOBAL',
    icon: 'Truck',
    layer: 'SEMANTIC',
    category: 'REFERENCE',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'supplierId', apiName: 'supplierId', displayName: '供应商ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'supplierName', apiName: 'supplierName', displayName: '供应商名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'contactPerson', apiName: 'contactPerson', displayName: '联系人', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'email', apiName: 'email', displayName: '邮箱', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'phone', apiName: 'phone', displayName: '电话', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'address', apiName: 'address', displayName: '地址', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'paymentTerms', apiName: 'paymentTerms', displayName: '付款条款', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'rating', apiName: 'rating', displayName: '供应商评级', baseType: 'INTEGER', visibility: 'NORMAL', required: true, minValue: 1, maxValue: 5 },
      { id: 'leadTimeDays', apiName: 'leadTimeDays', displayName: '平均交货期(天)', baseType: 'INTEGER', visibility: 'NORMAL', required: true, minValue: 1 },
    ],
  },

  // ===== 语义层 - 预算域 =====
  {
    id: 'budget-001',
    apiName: 'Budget',
    displayName: '预算',
    description: '图书馆采购预算分配',
    primaryKey: 'budgetCode',
    titleKey: 'budgetName',
    visibility: 'GLOBAL',
    icon: 'Wallet',
    layer: 'SEMANTIC',
    category: 'REFERENCE',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'budgetCode', apiName: 'budgetCode', displayName: '预算代码', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'budgetName', apiName: 'budgetName', displayName: '预算名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'fiscalYear', apiName: 'fiscalYear', displayName: '财年', baseType: 'INTEGER', visibility: 'PROMINENT', required: true },
      { id: 'totalAllocation', apiName: 'totalAllocation', displayName: '总拨款', baseType: 'DOUBLE', visibility: 'PROMINENT', required: true, minValue: 0 },
      { id: 'committedAmount', apiName: 'committedAmount', displayName: '已承诺', baseType: 'DOUBLE', visibility: 'NORMAL', required: true, defaultValue: '0', minValue: 0 },
      { id: 'spentAmount', apiName: 'spentAmount', displayName: '已支出', baseType: 'DOUBLE', visibility: 'NORMAL', required: true, defaultValue: '0', minValue: 0 },
      { id: 'availableAmount', apiName: 'availableAmount', displayName: '可用余额', baseType: 'DOUBLE', visibility: 'PROMINENT', required: true, minValue: 0 },
    ],
  },

  // ===== 语义层 - 部门域 =====
  {
    id: 'department-001',
    apiName: 'Department',
    displayName: '部门',
    description: '读者所属院系/部门',
    primaryKey: 'deptCode',
    titleKey: 'deptName',
    visibility: 'GLOBAL',
    icon: 'Building',
    layer: 'SEMANTIC',
    category: 'REFERENCE',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'deptCode', apiName: 'deptCode', displayName: '部门代码', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'deptName', apiName: 'deptName', displayName: '部门名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'faculty', apiName: 'faculty', displayName: '所属学院', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'contactEmail', apiName: 'contactEmail', displayName: '联系邮箱', baseType: 'STRING', visibility: 'NORMAL', required: false },
    ],
  },

  // ===== 语义层 - 罚款域 =====
  {
    id: 'fine-001',
    apiName: 'Fine',
    displayName: '罚款记录',
    description: '读者违规罚款明细',
    primaryKey: 'fineId',
    titleKey: 'fineId',
    visibility: 'GLOBAL',
    icon: 'AlertCircle',
    layer: 'SEMANTIC',
    category: 'TRANSACTION',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'fineId', apiName: 'fineId', displayName: '罚款ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'fineType', apiName: 'fineType', displayName: '罚款类型', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'OVERDUE/DAMAGE/LOST/OTHER' },
      { id: 'amount', apiName: 'amount', displayName: '罚款金额', baseType: 'DOUBLE', visibility: 'PROMINENT', required: true, minValue: 0 },
      { id: 'reason', apiName: 'reason', displayName: '原因', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'issuedDate', apiName: 'issuedDate', displayName: '开单日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'dueDate', apiName: 'dueDate', displayName: '缴纳截止', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'paidDate', apiName: 'paidDate', displayName: '缴纳日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: false },
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'OUTSTANDING/PAID/WAIVED' },
    ],
  },

  // ===== 语义层 - 图书馆域 =====
  {
    id: 'library-001',
    apiName: 'Library',
    displayName: '图书馆',
    description: '图书馆分支场馆信息',
    primaryKey: 'libraryId',
    titleKey: 'libraryName',
    visibility: 'GLOBAL',
    icon: 'Building2',
    layer: 'SEMANTIC',
    category: 'MASTER_DATA',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'libraryId', apiName: 'libraryId', displayName: '图书馆ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'libraryName', apiName: 'libraryName', displayName: '名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'address', apiName: 'address', displayName: '地址', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'phone', apiName: 'phone', displayName: '电话', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'openingHours', apiName: 'openingHours', displayName: '开放时间', baseType: 'STRING', visibility: 'NORMAL', required: false, description: '如: 8:00-22:00' },
      { id: 'totalCapacity', apiName: 'totalCapacity', displayName: '总容量', baseType: 'INTEGER', visibility: 'NORMAL', required: false },
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'NORMAL', required: true, description: 'OPEN/CLOSED/SEASONAL' },
    ],
  },

  // ===== 语义层 - 工作人员域 =====
  {
    id: 'staff-001',
    apiName: 'Staff',
    displayName: '工作人员',
    description: '图书馆员工信息',
    primaryKey: 'staffId',
    titleKey: 'staffName',
    visibility: 'GLOBAL',
    icon: 'Briefcase',
    layer: 'SEMANTIC',
    category: 'MASTER_DATA',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'staffId', apiName: 'staffId', displayName: '员工ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'staffName', apiName: 'staffName', displayName: '姓名', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'role', apiName: 'role', displayName: '岗位角色', baseType: 'STRING', visibility: 'PROMINENT', required: true, description: 'CIRCULATION/CATALOGING/REFERENCE/ADMIN' },
      { id: 'email', apiName: 'email', displayName: '邮箱', baseType: 'STRING', visibility: 'NORMAL', required: true },
      { id: 'phone', apiName: 'phone', displayName: '电话', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'hireDate', apiName: 'hireDate', displayName: '入职日期', baseType: 'TIMESTAMP', visibility: 'NORMAL', required: true },
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'NORMAL', required: true, description: 'ACTIVE/ON_LEAVE/TERMINATED' },
    ],
  },

  // ===== 语义层 - 分类域 =====
  {
    id: 'category-001',
    apiName: 'Category',
    displayName: '分类',
    description: '图书分类体系（如中图分类法）',
    primaryKey: 'categoryCode',
    titleKey: 'categoryName',
    visibility: 'GLOBAL',
    icon: 'Tag',
    layer: 'SEMANTIC',
    category: 'REFERENCE',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'categoryCode', apiName: 'categoryCode', displayName: '分类代码', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'categoryName', apiName: 'categoryName', displayName: '分类名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'parentCode', apiName: 'parentCode', displayName: '父分类', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'description', apiName: 'description', displayName: '描述', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'loanable', apiName: 'loanable', displayName: '可借阅', baseType: 'BOOLEAN', visibility: 'NORMAL', required: true, defaultValue: 'true' },
    ],
  },

  // ===== 语义层 - 出版社域 =====
  {
    id: 'publisher-001',
    apiName: 'Publisher',
    displayName: '出版社',
    description: '图书出版社信息',
    primaryKey: 'publisherId',
    titleKey: 'publisherName',
    visibility: 'GLOBAL',
    icon: 'Newspaper',
    layer: 'SEMANTIC',
    category: 'REFERENCE',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
    properties: [
      { id: 'publisherId', apiName: 'publisherId', displayName: '出版社ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'publisherName', apiName: 'publisherName', displayName: '出版社名称', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'country', apiName: 'country', displayName: '国家', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'website', apiName: 'website', displayName: '官网', baseType: 'STRING', visibility: 'NORMAL', required: false },
      { id: 'contactEmail', apiName: 'contactEmail', displayName: '联系邮箱', baseType: 'STRING', visibility: 'NORMAL', required: false },
    ],
  },
];

// 语义层链接类型
export const SAMPLE_LINK_TYPES: LinkType[] = [
  { id: 'link-loan-patron', apiName: 'PatronLoans', displayName: '读者借阅', description: '读者当前及历史借阅记录', sourceTypeId: 'patron-001', targetTypeId: 'loan-001', cardinality: 'ONE_TO_MANY', foreignKeyPropertyId: 'patronId', inverseLinkName: 'loanPatron', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-loan-holding', apiName: 'LoanHolding', displayName: '借阅馆藏', description: '借阅记录关联的馆藏副本', sourceTypeId: 'loan-001', targetTypeId: 'holding-001', cardinality: 'ONE_TO_ONE', foreignKeyPropertyId: 'loanId', inverseLinkName: 'holdingLoan', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-holding-book', apiName: 'HoldingBook', displayName: '馆藏实例化', description: '馆藏副本对应的图书元数据', sourceTypeId: 'holding-001', targetTypeId: 'book-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'barcode', inverseLinkName: 'bookCopies', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'COMPOSITION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-patron-dept', apiName: 'PatronDepartment', displayName: '读者部门', description: '读者所属部门/院系', sourceTypeId: 'patron-001', targetTypeId: 'department-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'patronId', inverseLinkName: 'deptPatrons', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-patron-reservation', apiName: 'PatronReservations', displayName: '读者预约', description: '读者的预约请求', sourceTypeId: 'patron-001', targetTypeId: 'reservation-001', cardinality: 'ONE_TO_MANY', foreignKeyPropertyId: 'patronId', inverseLinkName: 'reservationPatron', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-reservation-book', apiName: 'ReservationBook', displayName: '预约图书', description: '预约关联的图书', sourceTypeId: 'reservation-001', targetTypeId: 'book-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'reservationId', inverseLinkName: 'bookReservations', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-fine-patron', apiName: 'PatronFines', displayName: '读者罚款', description: '读者的罚款记录', sourceTypeId: 'patron-001', targetTypeId: 'fine-001', cardinality: 'ONE_TO_MANY', foreignKeyPropertyId: 'patronId', inverseLinkName: 'finePatron', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-fine-loan', apiName: 'FineLoan', displayName: '罚款借阅', description: '罚款关联的借阅记录', sourceTypeId: 'fine-001', targetTypeId: 'loan-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'fineId', inverseLinkName: 'loanFines', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-book-publisher', apiName: 'BookPublisher', displayName: '图书出版', description: '图书与出版社关系', sourceTypeId: 'book-001', targetTypeId: 'publisher-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'isbn', inverseLinkName: 'publishedBooks', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-book-category', apiName: 'BookCategory', displayName: '图书分类', description: '图书所属分类', sourceTypeId: 'book-001', targetTypeId: 'category-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'isbn', inverseLinkName: 'categorizedBooks', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-holding-library', apiName: 'HoldingLibrary', displayName: '馆藏归属', description: '馆藏所属图书馆', sourceTypeId: 'holding-001', targetTypeId: 'library-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'barcode', inverseLinkName: 'libraryHoldings', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
  { id: 'link-staff-library', apiName: 'StaffLibrary', displayName: '员工归属', description: '工作人员所属图书馆', sourceTypeId: 'staff-001', targetTypeId: 'library-001', cardinality: 'MANY_TO_ONE', foreignKeyPropertyId: 'staffId', inverseLinkName: 'libraryStaff', visibility: 'GLOBAL', layer: 'SEMANTIC', relationshipType: 'ASSOCIATION', createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-01-01T08:00:00Z', properties: [] },
];

// ----------------------------------------
// 第二部分：动势层 (Kinetic Layer)
// 世界如何变化 - 定义操作和数据流
// ----------------------------------------

export const SAMPLE_ACTION_TYPES: ActionType[] = [
  // ===== 借阅相关操作 =====
  {
    id: 'action-checkout',
    apiName: 'CheckoutBook',
    displayName: '借书',
    description: '读者借阅馆藏的操作',
    affectedObjectTypeIds: ['loan-001', 'holding-001', 'patron-001'],
    affectedLinkTypeIds: ['link-loan-patron', 'link-loan-holding'],
    inputParameters: [
      { id: 'patronId', apiName: 'patronId', displayName: '读者ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'barcode', apiName: 'barcode', displayName: '条码号', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'loanId', apiName: 'loanId', displayName: '借阅ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'dueDate', apiName: 'dueDate', displayName: '应还日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
    ],
    triggerConditions: [
      { condition: 'holding.status == AVAILABLE', description: '馆藏必须可借' },
      { condition: 'patron.accountStatus == ACTIVE', description: '读者账户必须活跃' },
      { condition: 'patron.outstandingFines < 10', description: '欠款不能超过10元' },
    ],
    postActions: ['action-send-checkout-notification'],
    requiredRoles: ['CIRCULATION_STAFF', 'SELF_SERVICE'],
    icon: 'ArrowRightCircle',
    color: '#10B981',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'action-return',
    apiName: 'ReturnBook',
    displayName: '还书',
    description: '读者归还馆藏的操作',
    affectedObjectTypeIds: ['loan-001', 'holding-001', 'fine-001'],
    affectedLinkTypeIds: ['link-fine-loan'],
    inputParameters: [
      { id: 'loanId', apiName: 'loanId', displayName: '借阅ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'condition', apiName: 'condition', displayName: '物理状况', baseType: 'STRING', visibility: 'NORMAL', required: false },
    ],
    outputProperties: [
      { id: 'returnDate', apiName: 'returnDate', displayName: '归还日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
      { id: 'fineAmount', apiName: 'fineAmount', displayName: '罚款金额', baseType: 'DOUBLE', visibility: 'NORMAL', required: false },
    ],
    triggerConditions: [
      { condition: 'loan.loanStatus == ACTIVE', description: '借阅必须处于活跃状态' },
    ],
    postActions: ['action-update-holding-status', 'action-check-reservations'],
    requiredRoles: ['CIRCULATION_STAFF', 'SELF_SERVICE'],
    icon: 'ArrowLeftCircle',
    color: '#3B82F6',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'action-renew',
    apiName: 'RenewLoan',
    displayName: '续借',
    description: '延长借阅期限',
    affectedObjectTypeIds: ['loan-001'],
    affectedLinkTypeIds: [],
    inputParameters: [
      { id: 'loanId', apiName: 'loanId', displayName: '借阅ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'newDueDate', apiName: 'newDueDate', displayName: '新应还日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
    ],
    triggerConditions: [
      { condition: 'loan.renewalCount < 2', description: '最多续借2次' },
      { condition: 'loan.loanStatus == ACTIVE', description: '借阅必须活跃' },
    ],
    requiredRoles: ['CIRCULATION_STAFF', 'PATRON_SELF_SERVICE'],
    icon: 'RefreshCw',
    color: '#8B5CF6',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  // ===== 预约相关操作 =====
  {
    id: 'action-reserve',
    apiName: 'CreateReservation',
    displayName: '创建预约',
    description: '读者预约图书',
    affectedObjectTypeIds: ['reservation-001', 'book-001'],
    affectedLinkTypeIds: ['link-patron-reservation', 'link-reservation-book'],
    inputParameters: [
      { id: 'patronId', apiName: 'patronId', displayName: '读者ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'isbn', apiName: 'isbn', displayName: 'ISBN', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'reservationId', apiName: 'reservationId', displayName: '预约ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'queuePosition', apiName: 'queuePosition', displayName: '队列位置', baseType: 'INTEGER', visibility: 'NORMAL', required: true },
    ],
    triggerConditions: [
      { condition: 'book.totalAvailableCopies > 0', description: '必须有可用副本' },
      { condition: 'patron.maxReservations < 3', description: '最多3个活跃预约' },
    ],
    postActions: ['action-check-reservation-fulfillment'],
    requiredRoles: ['PATRON', 'CIRCULATION_STAFF'],
    icon: 'CalendarPlus',
    color: '#F59E0B',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'action-cancel-reservation',
    apiName: 'CancelReservation',
    displayName: '取消预约',
    description: '读者取消预约',
    affectedObjectTypeIds: ['reservation-001'],
    affectedLinkTypeIds: ['link-patron-reservation'],
    inputParameters: [
      { id: 'reservationId', apiName: 'reservationId', displayName: '预约ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    triggerConditions: [
      { condition: 'reservation.status == ACTIVE', description: '预约必须活跃' },
    ],
    postActions: ['action-notify-next-in-queue'],
    requiredRoles: ['PATRON', 'CIRCULATION_STAFF'],
    icon: 'CalendarX',
    color: '#EF4444',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  // ===== 馆藏管理操作 =====
  {
    id: 'action-catalog',
    apiName: 'CatalogBook',
    displayName: '图书编目',
    description: '新入库图书的编目操作',
    affectedObjectTypeIds: ['book-001', 'holding-001'],
    affectedLinkTypeIds: ['link-holding-book'],
    inputParameters: [
      { id: 'isbn', apiName: 'isbn', displayName: 'ISBN', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'barcode', apiName: 'barcode', displayName: '条码号', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'callNumber', apiName: 'callNumber', displayName: '索书号', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'holdingId', apiName: 'holdingId', displayName: '馆藏ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    requiredRoles: ['CATALOGING_STAFF'],
    icon: 'FileText',
    color: '#06B6D4',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'action-weeding',
    apiName: 'WeedBook',
    displayName: '图书下架',
    description: '淘汰或注销馆藏',
    affectedObjectTypeIds: ['holding-001'],
    affectedLinkTypeIds: ['link-holding-library'],
    inputParameters: [
      { id: 'barcode', apiName: 'barcode', displayName: '条码号', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'reason', apiName: 'reason', displayName: '原因', baseType: 'STRING', visibility: 'NORMAL', required: true },
    ],
    outputProperties: [
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'PROMINENT', required: true },
    ],
    triggerConditions: [
      { condition: 'holding.status != LOANED', description: '借出的图书不能下架' },
    ],
    requiredRoles: ['CATALOGING_STAFF', 'ADMIN'],
    icon: 'Trash2',
    color: '#6B7280',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  // ===== 读者管理操作 =====
  {
    id: 'action-register-patron',
    apiName: 'RegisterPatron',
    displayName: '读者注册',
    description: '新读者注册账号',
    affectedObjectTypeIds: ['patron-001', 'department-001'],
    affectedLinkTypeIds: ['link-patron-dept'],
    inputParameters: [
      { id: 'patronId', apiName: 'patronId', displayName: '读者ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'patronName', apiName: 'patronName', displayName: '姓名', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'patronType', apiName: 'patronType', displayName: '读者类型', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'email', apiName: 'email', displayName: '邮箱', baseType: 'STRING', visibility: 'NORMAL', required: true },
    ],
    outputProperties: [
      { id: 'accountStatus', apiName: 'accountStatus', displayName: '账户状态', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'maxBooksAllowed', apiName: 'maxBooksAllowed', displayName: '最大借阅数', baseType: 'INTEGER', visibility: 'NORMAL', required: true },
    ],
    postActions: ['action-send-welcome-email'],
    requiredRoles: ['CIRCULATION_STAFF', 'ADMIN'],
    icon: 'UserPlus',
    color: '#10B981',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'action-pay-fine',
    apiName: 'PayFine',
    displayName: '缴纳罚款',
    description: '读者缴纳欠款',
    affectedObjectTypeIds: ['fine-001', 'patron-001'],
    affectedLinkTypeIds: ['link-fine-patron'],
    inputParameters: [
      { id: 'fineId', apiName: 'fineId', displayName: '罚款ID', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'amount', apiName: 'amount', displayName: '缴纳金额', baseType: 'DOUBLE', visibility: 'PROMINENT', required: true },
    ],
    outputProperties: [
      { id: 'status', apiName: 'status', displayName: '状态', baseType: 'STRING', visibility: 'PROMINENT', required: true },
      { id: 'paidDate', apiName: 'paidDate', displayName: '缴纳日期', baseType: 'TIMESTAMP', visibility: 'PROMINENT', required: true },
    ],
    triggerConditions: [
      { condition: 'fine.status == OUTSTANDING', description: '罚款必须未缴' },
    ],
    requiredRoles: ['CIRCULATION_STAFF', 'PATRON_SELF_SERVICE'],
    icon: 'CreditCard',
    color: '#F59E0B',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];

// 动势层数据流
export const SAMPLE_DATA_FLOWS: DataFlow[] = [
  {
    id: 'flow-checkout',
    apiName: 'CheckoutProcess',
    displayName: '借书流程',
    description: '完整的借书业务数据流',
    steps: [
      { stepOrder: 1, stepName: '验证读者', actionTypeId: 'action-checkout', transformation: 'patron = getPatron(patronId)' },
      { stepOrder: 2, stepName: '检查馆藏', actionTypeId: 'action-checkout', objectTypeId: 'holding-001', validation: 'holding.status == AVAILABLE' },
      { stepOrder: 3, stepName: '计算应还日期', transformation: 'dueDate = calculateDueDate(patron.patronType)' },
      { stepOrder: 4, stepName: '创建借阅记录', actionTypeId: 'action-checkout', objectTypeId: 'loan-001' },
      { stepOrder: 5, stepName: '更新馆藏状态', actionTypeId: 'action-return', objectTypeId: 'holding-001', transformation: 'holding.status = LOANED' },
    ],
    flowDirection: 'FORWARD',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'flow-return',
    apiName: 'ReturnProcess',
    displayName: '还书流程',
    description: '完整的还书业务数据流',
    steps: [
      { stepOrder: 1, stepName: '接收还书', actionTypeId: 'action-return', validation: 'scanBarcode(barcode)' },
      { stepOrder: 2, stepName: '检查超期', transformation: 'isOverdue = checkOverdue(loan.dueDate)' },
      { stepOrder: 3, stepName: '计算罚款', transformation: 'fineAmount = calculateFine(loan)' },
      { stepOrder: 4, stepName: '更新馆藏状态', actionTypeId: 'action-return', objectTypeId: 'holding-001', transformation: 'holding.status = AVAILABLE' },
      { stepOrder: 5, stepName: '更新借阅记录', actionTypeId: 'action-return', objectTypeId: 'loan-001', transformation: 'loan.returnDate = now()' },
      { stepOrder: 6, stepName: '检查预约队列', actionTypeId: 'action-check-reservations', objectTypeId: 'reservation-001' },
    ],
    flowDirection: 'BACKWARD',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'flow-acquisition',
    apiName: 'AcquisitionProcess',
    displayName: '采购流程',
    description: '图书采购到入库的业务数据流',
    steps: [
      { stepOrder: 1, stepName: '需求提交', objectTypeId: 'book-001' },
      { stepOrder: 2, stepName: '供应商选择', objectTypeId: 'supplier-001' },
      { stepOrder: 3, stepName: '预算审批', objectTypeId: 'budget-001', validation: 'budget.availableAmount >= book.price' },
      { stepOrder: 4, stepName: '创建订单', objectTypeId: 'purchase-order-001' },
      { stepOrder: 5, stepName: '图书编目', actionTypeId: 'action-catalog', objectTypeId: 'book-001' },
      { stepOrder: 6, stepName: '馆藏入库', objectTypeId: 'holding-001', transformation: 'holding.status = AVAILABLE' },
    ],
    flowDirection: 'FORWARD',
    visibility: 'GLOBAL',
    layer: 'KINETIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];

// ----------------------------------------
// 第三部分：动态层 (Dynamic Layer)
// 世界如何决策 - 定义规则和AI模型
// ----------------------------------------

export const SAMPLE_BUSINESS_RULES: BusinessRule[] = [
  // ===== 借阅规则 =====
  {
    id: 'rule-loan-limit',
    apiName: 'LoanLimitByPatronType',
    displayName: '借阅数量限制',
    description: '不同类型读者的借阅数量限制',
    ruleType: 'CONSTRAINT',
    expression: 'patron.currentLoanCount < patron.maxBooksAllowed',
    appliesToObjectTypeIds: ['patron-001', 'loan-001'],
    onViolation: { action: 'BLOCK', message: '已达到最大借阅数量限制' },
    priority: 90,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-loan-period',
    apiName: 'LoanPeriodByPatronType',
    displayName: '借阅期限规则',
    description: '根据读者类型设定不同的借阅期限',
    ruleType: 'DERIVATION',
    expression: 'loan.dueDate = loan.checkoutDate + patronType.loanPeriodDays',
    appliesToObjectTypeIds: ['loan-001', 'patron-001'],
    priority: 80,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-overdue-fine',
    apiName: 'OverdueFineRate',
    displayName: '超期罚款规则',
    description: '超期每天罚款0.5元',
    ruleType: 'CALCULATION',
    expression: 'fine.amount = daysOverdue * 0.5',
    appliesToObjectTypeIds: ['fine-001', 'loan-001'],
    priority: 85,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-reservation-priority',
    apiName: 'ReservationPriorityByType',
    displayName: '预约优先级规则',
    description: '教师>研究生>本科生的优先级排序',
    ruleType: 'DERIVATION',
    expression: 'reservation.priority = CASE patron.patronType WHEN "FACULTY" THEN 1 WHEN "GRAD" THEN 2 WHEN "UNDERGRAD" THEN 3',
    appliesToObjectTypeIds: ['reservation-001', 'patron-001'],
    priority: 70,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-reservation-limit',
    apiName: 'ReservationLimit',
    displayName: '预约数量限制',
    description: '每位读者最多3个活跃预约',
    ruleType: 'CONSTRAINT',
    expression: 'patron.activeReservationCount < 3',
    appliesToObjectTypeIds: ['patron-001', 'reservation-001'],
    onViolation: { action: 'BLOCK', message: '已达到最大预约数量限制' },
    priority: 90,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-fine-payment-required',
    apiName: 'FinePaymentRequired',
    displayName: '欠款限制借阅',
    description: '欠款超过10元不能借书',
    ruleType: 'CONSTRAINT',
    expression: 'patron.outstandingFines < 10',
    appliesToObjectTypeIds: ['patron-001'],
    onViolation: { action: 'BLOCK', message: '请先缴纳欠款后再借书' },
    priority: 95,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-renewal-limit',
    apiName: 'RenewalLimit',
    displayName: '续借次数限制',
    description: '每本图书最多续借2次',
    ruleType: 'CONSTRAINT',
    expression: 'loan.renewalCount < 2',
    appliesToObjectTypeIds: ['loan-001'],
    onViolation: { action: 'BLOCK', message: '该图书已达最大续借次数' },
    priority: 90,
    enabled: true,
    activationConditions: [
      { condition: 'loan.loanStatus == ACTIVE', description: '仅对活跃借阅生效' },
    ],
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'rule-pickup-expiry',
    apiName: 'ReservationPickupExpiry',
    displayName: '预约取书期限',
    description: '预约到书后需在3天内取书',
    ruleType: 'CONSTRAINT',
    expression: 'now() < reservation.pickupExpiry',
    appliesToObjectTypeIds: ['reservation-001'],
    onViolation: { action: 'WARN', message: '预约即将过期，请尽快取书' },
    priority: 60,
    enabled: true,
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];

// 动态层 AI 模型
export const SAMPLE_AI_MODELS: AIModel[] = [
  {
    id: 'ai-book-recommendation',
    apiName: 'BookRecommendation',
    displayName: '图书推荐引擎',
    description: '基于用户借阅历史和图书分类偏好进行个性化推荐',
    modelType: 'RECOMMENDATION',
    inputFeatures: [
      { objectTypeId: 'patron-001', propertyIds: ['patronId', 'patronType'], featureDescription: '读者特征' },
      { objectTypeId: 'loan-001', propertyIds: ['loanId', 'checkoutDate'], featureDescription: '历史借阅' },
      { objectTypeId: 'book-001', propertyIds: ['subjects', 'categoryCode'], featureDescription: '图书主题' },
    ],
    outputType: 'RANKING',
    outputDescription: '推荐图书列表及置信度分数',
    modelConfig: {
      algorithm: 'CollaborativeFiltering',
      topK: 10,
      minScore: 0.6,
    },
    trainingData: {
      objectTypeId: 'loan-001',
      dateRange: { start: '2023-01-01', end: '2024-01-01' },
      sampleSize: 100000,
    },
    metrics: [
      { metricName: 'precision@10', metricValue: 0.73 },
      { metricName: 'recall@10', metricValue: 0.45 },
      { metricName: 'ndcg@10', metricValue: 0.68 },
    ],
    modelSource: 'CUSTOM_TRAINED',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'ai-purchase-suggestion',
    apiName: 'PurchaseSuggestion',
    displayName: '采购建议模型',
    description: '基于热门度和库存分析推荐采购书目',
    modelType: 'PREDICTION',
    inputFeatures: [
      { objectTypeId: 'book-001', propertyIds: ['subjects', 'publicationYear'], featureDescription: '图书特征' },
      { objectTypeId: 'loan-001', propertyIds: ['loanId'], featureDescription: '借阅需求' },
      { objectTypeId: 'holding-001', propertyIds: ['status', 'condition'], featureDescription: '馆藏状态' },
    ],
    outputType: 'RANKING',
    outputDescription: '推荐采购图书及优先级',
    modelConfig: {
      algorithm: 'DemandForecasting',
      threshold: 0.7,
      topK: 50,
    },
    metrics: [
      { metricName: 'mae', metricValue: 12.5 },
      { metricName: 'rmse', metricValue: 18.3 },
    ],
    modelSource: 'CUSTOM_TRAINED',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'ai-reading-trend',
    apiName: 'ReadingTrendAnalysis',
    displayName: '阅读趋势分析',
    description: '分析阅读热点变化，识别季节性趋势',
    modelType: 'CLUSTERING',
    inputFeatures: [
      { objectTypeId: 'loan-001', propertyIds: ['checkoutDate', 'purpose'], featureDescription: '借阅时间线' },
      { objectTypeId: 'book-001', propertyIds: ['subjects', 'categoryCode'], featureDescription: '图书分类' },
    ],
    outputType: 'EMBEDDING',
    outputDescription: '阅读趋势向量和聚类标签',
    modelConfig: {
      algorithm: 'TimeSeriesClustering',
      clusterCount: 8,
    },
    metrics: [
      { metricName: 'silhouette', metricValue: 0.62 },
    ],
    modelSource: 'BUILT_IN',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'ai-churn-prediction',
    apiName: 'ReaderChurnPrediction',
    displayName: '读者流失预测',
    description: '识别可能流失的读者，以便进行精准营销',
    modelType: 'CLASSIFICATION',
    inputFeatures: [
      { objectTypeId: 'patron-001', propertyIds: ['registrationDate', 'patronType'], featureDescription: '读者属性' },
      { objectTypeId: 'loan-001', propertyIds: ['checkoutDate'], featureDescription: '借阅频率' },
    ],
    outputType: 'CLASSIFICATION',
    outputDescription: '流失风险等级 (HIGH/MEDIUM/LOW)',
    modelConfig: {
      algorithm: 'GradientBoosting',
      threshold: 0.5,
    },
    metrics: [
      { metricName: 'accuracy', metricValue: 0.84 },
      { metricName: 'f1_score', metricValue: 0.78 },
      { metricName: 'auc', metricValue: 0.89 },
    ],
    modelSource: 'CUSTOM_TRAINED',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];

// 动态层分析洞察
export const SAMPLE_ANALYSIS_INSIGHTS: AnalysisInsight[] = [
  {
    id: 'insight-popular-books',
    apiName: 'PopularBooksDashboard',
    displayName: '热门图书分析',
    description: '追踪最受欢迎的图书和分类',
    insightType: 'DASHBOARD',
    dataSources: [
      { objectTypeId: 'loan-001', propertyIds: ['loanId', 'checkoutDate'], aggregation: 'COUNT' },
      { objectTypeId: 'book-001', propertyIds: ['title', 'subjects'] },
      { objectTypeId: 'category-001', propertyIds: ['categoryName'] },
    ],
    visualization: {
      chartType: 'BAR',
      dimensions: ['book.title', 'category.categoryName'],
      measures: ['loan.count'],
    },
    refreshFrequency: 'DAILY',
    filters: [
      { objectTypeId: 'loan-001', propertyId: 'checkoutDate', operator: '>=', value: '30daysAgo' },
    ],
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'insight-reader-profile',
    apiName: 'ReaderProfileAnalysis',
    displayName: '读者阅读偏好画像',
    description: '分析读者的阅读偏好和借阅习惯',
    insightType: 'METRIC',
    dataSources: [
      { objectTypeId: 'patron-001', propertyIds: ['patronType', 'departmentCode'] },
      { objectTypeId: 'loan-001', propertyIds: ['purpose'], aggregation: 'COUNT' },
      { objectTypeId: 'category-001', propertyIds: ['categoryName'], aggregation: 'COUNT' },
    ],
    visualization: {
      chartType: 'PIE',
      dimensions: ['category.categoryName'],
      measures: ['loan.count'],
    },
    refreshFrequency: 'WEEKLY',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'insight-circulation-efficiency',
    apiName: 'CirculationEfficiency',
    displayName: '图书流通效率分析',
    description: '分析馆藏的流通率和周转效率',
    insightType: 'METRIC',
    dataSources: [
      { objectTypeId: 'holding-001', propertyIds: ['status', 'acquisitionDate'], aggregation: 'COUNT' },
      { objectTypeId: 'loan-001', propertyIds: ['loanId'], aggregation: 'COUNT' },
    ],
    visualization: {
      chartType: 'TABLE',
      dimensions: ['book.title', 'category.categoryName'],
      measures: ['holding.count', 'loan.count', 'circulation.rate'],
    },
    refreshFrequency: 'MONTHLY',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'insight-collection-optimization',
    apiName: 'CollectionOptimization',
    displayName: '馆藏结构优化建议',
    description: '基于借阅数据提出馆藏优化建议',
    insightType: 'ANOMALY',
    dataSources: [
      { objectTypeId: 'book-001', propertyIds: ['subjects', 'publicationYear'] },
      { objectTypeId: 'holding-001', propertyIds: ['condition', 'status'], aggregation: 'COUNT' },
      { objectTypeId: 'loan-001', propertyIds: ['loanId'], aggregation: 'COUNT' },
    ],
    visualization: {
      chartType: 'HEATMAP',
      dimensions: ['category.categoryName', 'holding.condition'],
      measures: ['loan.count'],
    },
    refreshFrequency: 'MONTHLY',
    filters: [
      { objectTypeId: 'holding-001', propertyId: 'status', operator: '==', value: 'AVAILABLE' },
    ],
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },

  {
    id: 'insight-overdue-trend',
    apiName: 'OverdueTrendForecast',
    displayName: '超期趋势预测',
    description: '预测未来的超期趋势，帮助提前准备',
    insightType: 'FORECAST',
    dataSources: [
      { objectTypeId: 'loan-001', propertyIds: ['dueDate', 'loanStatus'], aggregation: 'COUNT' },
      { objectTypeId: 'fine-001', propertyIds: ['amount'], aggregation: 'SUM' },
    ],
    visualization: {
      chartType: 'LINE',
      dimensions: ['date.week'],
      measures: ['overdue.count', 'fine.total'],
    },
    refreshFrequency: 'WEEKLY',
    visibility: 'GLOBAL',
    layer: 'DYNAMIC',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];
