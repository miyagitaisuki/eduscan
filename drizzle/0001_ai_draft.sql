ALTER TABLE "submissions" ADD COLUMN "ai_draft" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "ai_draft_at" timestamp with time zone;