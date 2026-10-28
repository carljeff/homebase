import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
 id: text("id").primaryKey(), kind: text("kind").notNull(), data: text("data").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(), updatedBy: text("updated_by").notNull()
});

// One private household per Sites database. Source and household overrides are separate.
export const importedRecipes=sqliteTable("imported_recipes",{
 id:text("id").primaryKey(), importKey:text("import_key").notNull().unique(),
 sourceHash:text("source_hash").notNull(), sourceData:text("source_data").notNull(),
 overrides:text("overrides").notNull().default("{}"), imageHash:text("image_hash"),
 version:integer("version").notNull().default(1), archived:integer("archived").notNull().default(0),
 updatedAt:text("updated_at").notNull(),updatedBy:text("updated_by").notNull()
});
