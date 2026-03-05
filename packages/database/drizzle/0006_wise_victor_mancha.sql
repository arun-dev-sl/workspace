CREATE TABLE "principal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" varchar(10) NOT NULL,
	"year" smallint NOT NULL,
	"label" varchar(20) NOT NULL,
	"amount_lakhs" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principal_distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "principal_contributions" ADD CONSTRAINT "principal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principal_distribution" ADD CONSTRAINT "principal_distribution_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "principal_contributions_user_id_idx" ON "principal_contributions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_contributions_user_month_year_uq" ON "principal_contributions" USING btree ("user_id","month","year");--> statement-breakpoint
CREATE INDEX "principal_distribution_user_id_idx" ON "principal_distribution" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_distribution_user_name_uq" ON "principal_distribution" USING btree ("user_id","name");