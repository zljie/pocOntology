import { MetaCore } from "@/lib/meta/meta-core";
import { OrmMapping } from "@/lib/orm/orm-mapping";
import { buildDefaultOrmMapping } from "@/lib/orm/postgres";

export function buildErpOrmMapping(meta: MetaCore): OrmMapping {
  const base = buildDefaultOrmMapping(meta);
  const tables: OrmMapping["tables"] = {};

  for (const [objectTypeId, table] of Object.entries(base.tables)) {
    tables[objectTypeId] = {
      ...table,
      tableName: table.tableName ? `erp_${table.tableName}` : table.tableName,
    };
  }

  return {
    ...base,
    databaseName: "erp_procurement",
    schemaName: "public",
    tables,
  };
}
