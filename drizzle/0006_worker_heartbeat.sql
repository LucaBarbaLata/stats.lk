CREATE TABLE "worker_heartbeat" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"beat_at" timestamp with time zone NOT NULL
);
