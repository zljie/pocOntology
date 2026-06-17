import "server-only";

export type OsiFileInput = {
  name: string;
  yamlText: string;
};

export type OsiImportError = {
  fileName: string;
  path: string;
  message: string;
};

export type OsiImportResult = {
  parsedCount: number;
  semanticModelCount: number;
  datasetCount: number;
  relationshipCount: number;
  fieldCount: number;
};

export type OsiCoreDocument = {
  version: string;
  semantic_model: Array<{
    name: string;
    description?: string;
    ai_context?: unknown;
    datasets: Array<{
      name: string;
      source: string;
      primary_key?: string[];
      unique_keys?: string[][];
      description?: string;
      ai_context?: unknown;
      fields?: Array<{
        name: string;
        description?: string;
        ai_context?: unknown;
        dimension?: { is_time?: boolean };
        expression?: unknown;
        label?: string;
      }>;
      custom_extensions?: Array<{ vendor_name: string; data: string }>;
    }>;
    relationships?: Array<{
      name: string;
      from: string;
      to: string;
      from_columns: string[];
      to_columns: string[];
      ai_context?: unknown;
      custom_extensions?: Array<{ vendor_name: string; data: string }>;
    }>;
    metrics?: Array<{
      name: string;
      description?: string;
      ai_context?: unknown;
      expression: {
        dialects: Array<{ dialect: string; expression: string }>;
      };
      custom_extensions?: Array<{ vendor_name: string; data: string }>;
    }>;
    custom_extensions?: Array<{ vendor_name: string; data: string }>;
  }>;
};

export type OsiBehaviorLayer = {
  namespace: string;
  behavior_layer_version: string;
  metadata?: Record<string, unknown>;
  action_types: Array<{
    id: string;
    title: string;
    description?: string;
    kind?: "command" | "query";
    operation?: string;
    aggregate?: string;
    entity_name?: string;
    idempotency?: "idempotent" | "non_idempotent" | "unknown";
    applies_to?: {
      entity?: "dataset" | "field" | "metric" | "relationship";
      selectors?: {
        field_names?: string[];
        metric_names?: string[];
        relationship_names?: string[];
      };
    };
    io_schema?: { input_schema?: any; output_schema?: any };
    examples?: string[];
    tool_hint?: { tool_name?: string; dialect?: string };
    tags?: string[];
    synonyms?: string[];
    deprecated?: boolean;
    version?: string;
    [key: string]: unknown;
  }>;
  rules: Array<{
    id: string;
    title: string;
    description?: string;
    severity: "error" | "warn" | "info";
    when: {
      entity: "dataset" | "field" | "metric" | "relationship";
      selectors?: {
        field_names?: string[];
        metric_names?: string[];
        relationship_names?: string[];
      };
      [key: string]: unknown;
    };
    if?: Record<string, unknown>;
    constraint: { type: string; [key: string]: unknown };
    message: string;
    remediation?: string;
    references?: Array<Record<string, unknown>>;
    tags?: string[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};
