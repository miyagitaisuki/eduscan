CREATE TABLE "textbook_lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"book" varchar(100) NOT NULL,
	"lesson_no" integer NOT NULL,
	"title_ja" text DEFAULT '' NOT NULL,
	"title_vi" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "textbook_lessons" ADD CONSTRAINT "textbook_lessons_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_textbook_book_lesson" ON "textbook_lessons" USING btree ("book","lesson_no");--> statement-breakpoint
ALTER TABLE "textbook_lessons" ENABLE ROW LEVEL SECURITY;