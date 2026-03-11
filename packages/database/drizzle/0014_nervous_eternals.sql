ALTER TABLE "hotel_stays" ALTER COLUMN "check_in_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hotel_stays" ALTER COLUMN "check_out_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hotel_stays" ALTER COLUMN "nights" DROP NOT NULL;