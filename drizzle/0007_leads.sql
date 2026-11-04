CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'trial', 'enrolled', 'declined');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"current_level" varchar(100),
	"target_jlpt" varchar(50),
	"notes" text,
	"source" varchar(300),
	"consent_at" timestamp with time zone NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_leads_status_created" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
