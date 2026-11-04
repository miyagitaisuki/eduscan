ALTER TABLE "assignments" ADD COLUMN "kind" varchar(20) DEFAULT 'homework' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "minna_lesson" integer;