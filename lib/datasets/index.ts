import "server-only";

import { DatasetProvider } from "@/lib/datasets/types";
import { JsonEntitiesProvider } from "@/lib/datasets/json-entities-provider";

let providerSingleton: DatasetProvider | null = null;

export function getDatasetProvider(): DatasetProvider {
  if (providerSingleton) return providerSingleton;
  providerSingleton = new JsonEntitiesProvider();
  return providerSingleton;
}

