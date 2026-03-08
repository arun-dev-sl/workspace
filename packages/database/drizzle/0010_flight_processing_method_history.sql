ALTER TABLE "flight_email_processing"
ALTER COLUMN "extraction_method" DROP DEFAULT;

ALTER TABLE "flight_email_processing"
ALTER COLUMN "extraction_method"
TYPE text[]
USING (
  CASE
    WHEN "extraction_method" = 'none' OR "extraction_method" IS NULL THEN ARRAY[]::text[]
    ELSE ARRAY["extraction_method"]::text[]
  END
);

ALTER TABLE "flight_email_processing"
ALTER COLUMN "extraction_method" SET DEFAULT '{}'::text[];