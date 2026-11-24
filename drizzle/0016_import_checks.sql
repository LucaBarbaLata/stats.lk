CREATE TABLE "import_checks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plays" integer NOT NULL,
	"checked" integer NOT NULL,
	"too_long" integer NOT NULL,
	"unknown" integer NOT NULL,
	"overlapping" integer NOT NULL,
	"impossible_days" integer NOT NULL,
	"unusual" boolean NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_checks" ADD CONSTRAINT "import_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;