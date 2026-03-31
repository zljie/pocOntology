import "server-only";
import neo4j, { Driver } from "neo4j-driver";

let driverSingleton: Driver | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.toString().trim();
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}

export function getNeo4jDatabase(): string | undefined {
  const value = process.env.NEO4J_DATABASE?.toString().trim();
  return value || undefined;
}

export function getNeo4jDriver(): Driver {
  if (driverSingleton) return driverSingleton;

  const uri = requireEnv("NEO4J_URI");
  const username = (process.env.NEO4J_USERNAME?.toString().trim() || "neo4j").trim();
  const password = requireEnv("NEO4J_PASSWORD");

  driverSingleton = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    disableLosslessIntegers: true,
  });

  return driverSingleton;
}

