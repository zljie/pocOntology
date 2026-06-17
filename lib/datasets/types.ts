export type DatasetKind = "json-entities-v1";

export interface DatasetManifestItem {
  id: string;
  name: string;
  description?: string;
  type: DatasetKind;
  file: string;
  entities: string[];
}

export interface DatasetManifest {
  version: string;
  datasets: DatasetManifestItem[];
}

export type QueryOperator = "eq" | "contains" | "gt" | "gte" | "lt" | "lte" | "in";

export interface QueryCondition {
  field: string;
  op: QueryOperator;
  value: unknown;
}

export interface QuerySpec {
  datasetId: string;
  entity: string;
  where?: {
    op: "and" | "or";
    conditions: QueryCondition[];
  };
  limit?: number; // 默认 20
  offset?: number; // 默认 0
}

export interface DatasetSchema {
  entity: string;
  fields: { name: string; types: string[] }[];
  rowCount: number;
}

export interface QueryEvidence {
  datasetId: string;
  entity: string;
  where?: QuerySpec["where"];
  matchedCount: number;
  returnedCount: number;
  sampleRows: any[];
  pseudoSql: string;
}

export interface DatasetProvider {
  listDatasets(): Promise<DatasetManifestItem[]>;
  getSchema(datasetId: string, entity: string): Promise<DatasetSchema>;
  query(spec: QuerySpec): Promise<QueryEvidence>;
}

