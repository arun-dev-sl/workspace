CREATE TABLE "dividends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"isin" varchar(20) NOT NULL,
	"ex_date" date NOT NULL,
	"shares" integer NOT NULL,
	"dividend_per_share" numeric(18, 4) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"invested_value" numeric(18, 2),
	"report_period_from" date,
	"report_period_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dividends_user_id_idx" ON "dividends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dividends_ex_date_idx" ON "dividends" USING btree ("ex_date");--> statement-breakpoint
CREATE UNIQUE INDEX "dividends_user_isin_exdate_uq" ON "dividends" USING btree ("user_id","isin","ex_date");--> statement-breakpoint
CREATE INDEX "transactions_user_transaction_date_idx" ON "transactions" USING btree ("user_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_user_category_idx" ON "transactions" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "transactions_transaction_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_card_last4_idx" ON "transactions" USING btree ("card_last4");