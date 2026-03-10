ALTER TABLE "flight_activities"
ALTER COLUMN "extraction_method" DROP DEFAULT;

ALTER TABLE "flight_activities"
ALTER COLUMN "extraction_method"
TYPE text[]
USING (
  CASE
    WHEN "extraction_method" IS NULL THEN ARRAY[]::text[]
    ELSE ARRAY["extraction_method"]::text[]
  END
);

ALTER TABLE "flight_activities"
ALTER COLUMN "extraction_method" SET DEFAULT '{}'::text[];