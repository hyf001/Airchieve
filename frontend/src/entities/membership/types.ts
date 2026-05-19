export type BillingPeriod = "none" | "month" | "quarter" | "year";
export type MembershipPlanStatus = "active" | "inactive";
export type UserMembershipStatus = "free" | "active" | "past_due" | "canceled" | "expired";
export type EntitlementAccessLevel = "free" | "member";
export type PdfExportQuality = "standard" | "hd";

export interface EntitlementConfig {
  access_level: EntitlementAccessLevel;
  book_access_level: EntitlementAccessLevel;
  child_profile_limit: number;
  story_limit: number;
  character_limit: number;
  voice_limit: number;
  share_monthly_limit: number;
  book_generation_monthly_limit: number;
  pdf_export_monthly_limit: number;
  vip_asset_enabled: boolean;
  pdf_export_quality: PdfExportQuality;
}

export interface MembershipPlan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_period: BillingPeriod;
  entitlement_config: EntitlementConfig;
  sort_order: number;
  status: MembershipPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface UserMembership {
  user_id: number;
  plan: {
    id: number | null;
    code: string;
    name: string;
    billing_period: BillingPeriod;
  };
  status: UserMembershipStatus;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  source: "system" | "payment" | "admin";
}

export interface UserEntitlements {
  plan_code: string;
  membership_status: UserMembershipStatus;
  access_level: EntitlementAccessLevel;
  book_access_level: EntitlementAccessLevel;
  limits: {
    child_profile_limit: number;
    story_limit: number;
    character_limit: number;
    voice_limit: number;
    share_monthly_limit: number;
    book_generation_monthly_limit: number;
    pdf_export_monthly_limit: number;
    pdf_export_quality: PdfExportQuality;
  };
  usages: {
    period_key: string;
    book_generation_monthly_used: number;
    book_generation_monthly_reserved: number;
    share_monthly_used: number;
    share_monthly_reserved: number;
    pdf_export_monthly_used: number;
    pdf_export_monthly_reserved: number;
  };
  vip_permissions: {
    vip_asset_enabled: boolean;
    system_story_vip_enabled: boolean;
    system_template_vip_enabled: boolean;
    export_hd_enabled: boolean;
  };
}
