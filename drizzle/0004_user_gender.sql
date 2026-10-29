CREATE TYPE "public"."user_gender" AS ENUM('male', 'female');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" "user_gender";
