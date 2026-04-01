import { Cardinality } from "@/lib/types/ontology";

export type OrmDialect = "postgres";

export type PrimaryKeyStrategy = "PROPERTY" | "UUID";

export interface OrmColumnMapping {
  propertyId: string;
  columnName: string;
  sqlType?: string;
  nullable?: boolean;
}

export interface OrmTableMapping {
  objectTypeId: string;
  tableName: string;
  primaryKeyStrategy: PrimaryKeyStrategy;
  primaryKeyPropertyId?: string;
  primaryKeyColumnName?: string;
  columns: Record<string, OrmColumnMapping>;
}

export type ForeignKeyPlacement = "SOURCE" | "TARGET";

export interface OrmLinkMapping {
  linkTypeId: string;
  cardinality: Cardinality;
  foreignKeyPlacement: ForeignKeyPlacement;
  foreignKeyColumnName?: string;
  joinTableName?: string;
  joinSourceColumnName?: string;
  joinTargetColumnName?: string;
}

export interface OrmMapping {
  dialect: OrmDialect;
  databaseName?: string;
  schemaName?: string;
  tables: Record<string, OrmTableMapping>;
  links: Record<string, OrmLinkMapping>;
}
