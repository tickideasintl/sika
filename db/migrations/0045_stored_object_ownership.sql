CREATE TABLE "stored_objects" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stored_objects_workspace" ON "stored_objects" USING btree ("workspace_id");
--> statement-breakpoint
-- Only the file-upload endpoint created these UUID document rows and keys.
-- 0023's legacy-* rows came from attacker-editable receipt references: NEVER
-- use those (or transactions.receipt_storage_id) as ownership evidence.
INSERT INTO "stored_objects" ("storage_key", "workspace_id", "created_at")
SELECT "storage_key", min("workspace_id"), min("created_at")
FROM "transaction_documents"
WHERE "id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND "storage_key" ~ '^supporting-documents/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
  AND "size_bytes" > 0 AND "mime_type" IS NOT NULL
GROUP BY "storage_key"
HAVING count(DISTINCT "workspace_id") = 1;