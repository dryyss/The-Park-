-- Add city field to User for location-based filtering on marketplace
ALTER TABLE "User" ADD COLUMN "city" TEXT;
