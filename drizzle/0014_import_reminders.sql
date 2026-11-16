ALTER TABLE "users" ADD COLUMN "import_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reminder_sent_at" timestamp with time zone;