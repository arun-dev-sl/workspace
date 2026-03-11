ALTER TABLE "flight_activities" ALTER COLUMN "extraction_method" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "flight_activities" ALTER COLUMN "extraction_method" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "flight_email_processing" ALTER COLUMN "extraction_method" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "flight_email_processing" ALTER COLUMN "extraction_method" SET DEFAULT '{}'::text[];