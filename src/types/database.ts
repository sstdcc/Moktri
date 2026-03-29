import type { Tables, Enums } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;
export type District = Tables<'districts'>;
export type Listing = Tables<'listings'>;
export type ListingImage = Tables<'listing_images'>;
export type HousingRequest = Tables<'housing_requests'>;
export type RequestResponse = Tables<'request_responses'>;
export type Favorite = Tables<'favorites'>;
export type Report = Tables<'reports'>;
export type Notification = Tables<'notifications'>;
export type VerificationApplication = Tables<'verification_applications'>;

export type UserRole = Enums<'user_role'>;
export type ListingCategory = Enums<'listing_category'>;
export type ListingStatus = Enums<'listing_status'>;
export type BillingPeriod = Enums<'billing_period'>;
export type FurnishingType = Enums<'furnishing_type'>;
export type AllowedForType = Enums<'allowed_for_type'>;
export type RequestStatus = Enums<'request_status'>;
export type ReportReason = Enums<'report_reason'>;
export type NotificationType = Enums<'notification_type'>;
export type VerificationBadgeStatus = Enums<'verification_badge_status'>;
