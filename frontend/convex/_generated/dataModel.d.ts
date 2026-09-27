import type { DataModelFromSchemaDefinition } from "convex/server";
import type schema from "../schema.js";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type Doc<TableName extends keyof DataModel> = DataModel[TableName]["document"];
export type Id<TableName extends keyof DataModel> = DataModel[TableName]["document"]["_id"];
