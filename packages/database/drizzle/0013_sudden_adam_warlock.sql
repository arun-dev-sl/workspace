CREATE TABLE "hotel_email_processing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_email_id" uuid NOT NULL,
	"status" text NOT NULL,
	"extraction_method" text[] DEFAULT '{}'::text[] NOT NULL,
	"matched_stays" integer DEFAULT 0 NOT NULL,
	"llm_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_email_id" uuid,
	"extraction_method" text[] DEFAULT '{}'::text[] NOT NULL,
	"canonical_hash" text NOT NULL,
	"hotel_name" text NOT NULL,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"city" text,
	"country" text,
	"timezone" text,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"nights" integer NOT NULL,
	"extraction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" numeric(5, 4) DEFAULT '0' NOT NULL,
	"pricing_currency" text,
	"pricing_total" numeric(12, 2),
	"pricing_nightly" numeric(12, 2),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotel_email_processing" ADD CONSTRAINT "hotel_email_processing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_email_processing" ADD CONSTRAINT "hotel_email_processing_source_email_id_raw_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."raw_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_stays" ADD CONSTRAINT "hotel_stays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_stays" ADD CONSTRAINT "hotel_stays_source_email_id_raw_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."raw_emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_email_processing_source_email_idx" ON "hotel_email_processing" USING btree ("source_email_id");--> statement-breakpoint
CREATE INDEX "hotel_email_processing_user_status_idx" ON "hotel_email_processing" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_stays_user_canonical_hash_idx" ON "hotel_stays" USING btree ("user_id","canonical_hash");--> statement-breakpoint
CREATE INDEX "hotel_stays_user_check_in_date_idx" ON "hotel_stays" USING btree ("user_id","check_in_date");--> statement-breakpoint
CREATE INDEX "hotel_stays_user_archived_at_idx" ON "hotel_stays" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "hotel_stays_source_email_idx" ON "hotel_stays" USING btree ("source_email_id");