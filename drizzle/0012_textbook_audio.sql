CREATE TABLE "textbook_audio" (
	"id" text PRIMARY KEY NOT NULL,
	"book" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"mp3_path" varchar(500) NOT NULL,
	"srt_path" varchar(500),
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "textbook_audio" ADD CONSTRAINT "textbook_audio_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_textbook_audio_book_code" ON "textbook_audio" USING btree ("book","code");--> statement-breakpoint
ALTER TABLE "textbook_audio" ENABLE ROW LEVEL SECURITY;
