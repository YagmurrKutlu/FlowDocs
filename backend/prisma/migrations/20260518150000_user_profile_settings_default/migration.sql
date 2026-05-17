-- Ensure settings column exists with safe default for legacy databases
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}';

UPDATE "UserProfile" SET "settings" = '{}'::jsonb WHERE "settings" IS NULL;

ALTER TABLE "UserProfile" ALTER COLUMN "settings" SET DEFAULT '{}'::jsonb;
