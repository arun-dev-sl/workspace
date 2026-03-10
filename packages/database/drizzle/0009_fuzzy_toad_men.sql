CREATE TABLE "flight_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_email_id" uuid NOT NULL,
	"activity_type" text DEFAULT 'booking_confirmation' NOT NULL,
	"extraction_method" text NOT NULL,
	"canonical_hash" text NOT NULL,
	"segment_index" integer NOT NULL,
	"pnr" text,
	"airline_name" text,
	"flight_number" text NOT NULL,
	"from_airport" text NOT NULL,
	"to_airport" text NOT NULL,
	"departure_date" date NOT NULL,
	"departure_time" text,
	"arrival_date" date,
	"arrival_time" text,
	"departure_at" timestamp with time zone,
	"arrival_at" timestamp with time zone,
	"departure_timezone" text,
	"arrival_timezone" text,
	"travel_class" text,
	"confidence" numeric(5, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flight_email_processing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_email_id" uuid NOT NULL,
	"status" text NOT NULL,
	"extraction_method" text DEFAULT 'none' NOT NULL,
	"matched_activities" integer DEFAULT 0 NOT NULL,
	"llm_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flight_activities" ADD CONSTRAINT "flight_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_activities" ADD CONSTRAINT "flight_activities_source_email_id_raw_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."raw_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_email_processing" ADD CONSTRAINT "flight_email_processing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_email_processing" ADD CONSTRAINT "flight_email_processing_source_email_id_raw_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."raw_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flight_activities_user_canonical_hash_idx" ON "flight_activities" USING btree ("user_id","canonical_hash");--> statement-breakpoint
CREATE INDEX "flight_activities_user_departure_date_idx" ON "flight_activities" USING btree ("user_id","departure_date");--> statement-breakpoint
CREATE INDEX "flight_activities_user_pnr_idx" ON "flight_activities" USING btree ("user_id","pnr");--> statement-breakpoint
CREATE UNIQUE INDEX "flight_email_processing_source_email_idx" ON "flight_email_processing" USING btree ("source_email_id");--> statement-breakpoint
CREATE INDEX "flight_email_processing_user_status_idx" ON "flight_email_processing" USING btree ("user_id","status");