CREATE TYPE "public"."lesson_status" AS ENUM('planned', 'cancelled');--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "weekdays" integer[];--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "lesson_start_time" time;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "lesson_end_time" time;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "end_date" date;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"lesson_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"notes" text,
	"status" "lesson_status" DEFAULT 'planned' NOT NULL,
	"manually_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_lesson_class_date" ON "lessons" USING btree ("class_id","lesson_date");--> statement-breakpoint
CREATE INDEX "idx_holidays_start" ON "holidays" USING btree ("start_date");--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
