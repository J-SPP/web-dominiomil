-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "websites" (
    "id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL,
    "registered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_tokens" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_api_keys" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_forms" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "website_id" UUID,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_monthly" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "prompt_tokens" BIGINT NOT NULL DEFAULT 0,
    "completion_tokens" BIGINT NOT NULL DEFAULT 0,
    "total_tokens" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_knowledge" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "last_synced_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_connections" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "google_account_email" TEXT NOT NULL,
    "google_calendar_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_dashboard_state" (
    "id" UUID NOT NULL,
    "viewer_website_id" UUID NOT NULL,
    "target_website_id" UUID NOT NULL,
    "last_contact_view" TIMESTAMPTZ,
    "last_booking_view" TIMESTAMPTZ,
    "last_notification_view" TIMESTAMPTZ,
    "last_support_view" TIMESTAMPTZ,

    CONSTRAINT "website_dashboard_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "websites_domain_key" ON "websites"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "signup_tokens_token_key" ON "signup_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "signup_tokens_domain_key" ON "signup_tokens"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "website_api_keys_website_id_name_key" ON "website_api_keys"("website_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_monthly_website_id_year_month_key" ON "ai_usage_monthly"("website_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_knowledge_website_id_key" ON "chatbot_knowledge"("website_id");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_connections_website_id_key" ON "google_calendar_connections"("website_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_dashboard_state_viewer_website_id_target_website_id_key" ON "website_dashboard_state"("viewer_website_id", "target_website_id");

-- Create Index on Foreign Keys per database specifications
CREATE INDEX "contact_forms_website_id_idx" ON "contact_forms"("website_id");
CREATE INDEX "bookings_website_id_idx" ON "bookings"("website_id");
CREATE INDEX "notifications_website_id_idx" ON "notifications"("website_id");
CREATE INDEX "support_requests_website_id_idx" ON "support_requests"("website_id");
CREATE INDEX "website_api_keys_website_id_idx" ON "website_api_keys"("website_id");

-- AddForeignKey
ALTER TABLE "website_api_keys" ADD CONSTRAINT "website_api_keys_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_forms" ADD CONSTRAINT "contact_forms_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_monthly" ADD CONSTRAINT "ai_usage_monthly_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_knowledge" ADD CONSTRAINT "chatbot_knowledge_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_dashboard_state" ADD CONSTRAINT "website_dashboard_state_viewer_website_id_fkey" FOREIGN KEY ("viewer_website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_dashboard_state" ADD CONSTRAINT "website_dashboard_state_target_website_id_fkey" FOREIGN KEY ("target_website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create trigger function for automatically maintaining updated_at values
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach update_updated_at_column to tables containing updated_at fields
CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_usage_monthly_updated_at BEFORE UPDATE ON ai_usage_monthly FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbot_knowledge_updated_at BEFORE UPDATE ON chatbot_knowledge FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_google_calendar_connections_updated_at BEFORE UPDATE ON google_calendar_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
