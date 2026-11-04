CREATE TYPE "public"."hidden_item_type" AS ENUM('artist', 'track');--> statement-breakpoint
CREATE TABLE "hidden_items" (
	"user_id" uuid NOT NULL,
	"type" "hidden_item_type" NOT NULL,
	"item_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hidden_items_user_id_type_item_id_pk" PRIMARY KEY("user_id","type","item_id")
);
--> statement-breakpoint
ALTER TABLE "hidden_items" ADD CONSTRAINT "hidden_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;