import { GraphqlActionInterfaceMapping } from "@/lib/types/ontology";

function toLowerCamel(name: string) {
  if (!name) return name;
  return name[0].toLowerCase() + name.slice(1);
}

export function buildGraphqlTemplate(mapping: GraphqlActionInterfaceMapping) {
  const inputArgName = mapping.inputArgName || "input";
  const varDefs = mapping.inputFields
    .map((f) => {
      const t = mapping.inputVarTypes?.[f] || "String!";
      return `$${f}: ${t}`;
    })
    .join(", ");
  const inputObj = mapping.inputFields.map((f) => `${f}: $${f}`).join(", ");
  const selection = mapping.outputFields.length > 0 ? mapping.outputFields.join("\n    ") : "ok";
  const opType = mapping.operationType;
  const opName = mapping.operationName || toLowerCamel(mapping.rootField || "Action");
  const rootField = mapping.rootField || toLowerCamel(opName);

  return `${opType} ${opName}(${varDefs}) {
  ${rootField}(${inputArgName}: { ${inputObj} }) {
    ${selection}
  }
}`;
}
