export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      districts: {
        Row: {
          city: string | null
          id: string
          is_active: boolean | null
          listing_count: number | null
          name_ar: string
          name_en: string | null
        }
        Insert: {
          city?: string | null
          id?: string
          is_active?: boolean | null
          listing_count?: number | null
          name_ar: string
          name_en?: string | null
        }
        Update: {
          city?: string | null
          id?: string
          is_active?: boolean | null
          listing_count?: number | null
          name_ar?: string
          name_en?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_requests: {
        Row: {
          bedrooms_needed: number | null
          category: Database["public"]["Enums"]["listing_category"]
          city_name: string | null
          created_at: string | null
          currency: string | null
          district_id: string | null
          expires_at: string | null
          for_whom: Database["public"]["Enums"]["for_whom_type"] | null
          furnishing_preference:
            | Database["public"]["Enums"]["furnishing_preference"]
            | null
          governorate: string | null
          id: string
          max_price: number | null
          min_price: number | null
          move_in_date: string | null
          neighborhood: string | null
          notes: string | null
          requester_id: string
          responses_count: number | null
          status: Database["public"]["Enums"]["request_status"] | null
          views_count: number | null
        }
        Insert: {
          bedrooms_needed?: number | null
          category: Database["public"]["Enums"]["listing_category"]
          city_name?: string | null
          created_at?: string | null
          currency?: string | null
          district_id?: string | null
          expires_at?: string | null
          for_whom?: Database["public"]["Enums"]["for_whom_type"] | null
          furnishing_preference?:
            | Database["public"]["Enums"]["furnishing_preference"]
            | null
          governorate?: string | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          move_in_date?: string | null
          neighborhood?: string | null
          notes?: string | null
          requester_id: string
          responses_count?: number | null
          status?: Database["public"]["Enums"]["request_status"] | null
          views_count?: number | null
        }
        Update: {
          bedrooms_needed?: number | null
          category?: Database["public"]["Enums"]["listing_category"]
          city_name?: string | null
          created_at?: string | null
          currency?: string | null
          district_id?: string | null
          expires_at?: string | null
          for_whom?: Database["public"]["Enums"]["for_whom_type"] | null
          furnishing_preference?:
            | Database["public"]["Enums"]["furnishing_preference"]
            | null
          governorate?: string | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          move_in_date?: string | null
          neighborhood?: string | null
          notes?: string | null
          requester_id?: string
          responses_count?: number | null
          status?: Database["public"]["Enums"]["request_status"] | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "housing_requests_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_conversations: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          owner_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          owner_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          owner_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          listing_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          listing_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          listing_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          allowed_for: Database["public"]["Enums"]["allowed_for_type"] | null
          bathrooms: number | null
          bedrooms: number | null
          billing_period: Database["public"]["Enums"]["billing_period"] | null
          category: Database["public"]["Enums"]["listing_category"]
          city_name: string | null
          contact_clicks: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          district_id: string | null
          expires_at: string | null
          favorites_count: number | null
          floor_number: number | null
          furnishing: Database["public"]["Enums"]["furnishing_type"] | null
          governorate: string | null
          has_electricity: boolean | null
          has_internet: boolean | null
          has_parking: boolean | null
          has_water: boolean | null
          id: string
          is_featured: boolean | null
          is_negotiable: boolean | null
          is_urgent: boolean | null
          kitchens: number | null
          last_updated_at: string | null
          moderation_note: string | null
          neighborhood: string | null
          offered_at: string | null
          owner_id: string
          price: number
          property_size: number | null
          published_at: string | null
          quality_score: number | null
          reserved_for_user_id: string | null
          source_request_id: string | null
          status: Database["public"]["Enums"]["listing_status"] | null
          title: string
          views_count: number | null
          whatsapp_clicks: number | null
        }
        Insert: {
          allowed_for?: Database["public"]["Enums"]["allowed_for_type"] | null
          bathrooms?: number | null
          bedrooms?: number | null
          billing_period?: Database["public"]["Enums"]["billing_period"] | null
          category: Database["public"]["Enums"]["listing_category"]
          city_name?: string | null
          contact_clicks?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          district_id?: string | null
          expires_at?: string | null
          favorites_count?: number | null
          floor_number?: number | null
          furnishing?: Database["public"]["Enums"]["furnishing_type"] | null
          governorate?: string | null
          has_electricity?: boolean | null
          has_internet?: boolean | null
          has_parking?: boolean | null
          has_water?: boolean | null
          id?: string
          is_featured?: boolean | null
          is_negotiable?: boolean | null
          is_urgent?: boolean | null
          kitchens?: number | null
          last_updated_at?: string | null
          moderation_note?: string | null
          neighborhood?: string | null
          offered_at?: string | null
          owner_id: string
          price: number
          property_size?: number | null
          published_at?: string | null
          quality_score?: number | null
          reserved_for_user_id?: string | null
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["listing_status"] | null
          title: string
          views_count?: number | null
          whatsapp_clicks?: number | null
        }
        Update: {
          allowed_for?: Database["public"]["Enums"]["allowed_for_type"] | null
          bathrooms?: number | null
          bedrooms?: number | null
          billing_period?: Database["public"]["Enums"]["billing_period"] | null
          category?: Database["public"]["Enums"]["listing_category"]
          city_name?: string | null
          contact_clicks?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          district_id?: string | null
          expires_at?: string | null
          favorites_count?: number | null
          floor_number?: number | null
          furnishing?: Database["public"]["Enums"]["furnishing_type"] | null
          governorate?: string | null
          has_electricity?: boolean | null
          has_internet?: boolean | null
          has_parking?: boolean | null
          has_water?: boolean | null
          id?: string
          is_featured?: boolean | null
          is_negotiable?: boolean | null
          is_urgent?: boolean | null
          kitchens?: number | null
          last_updated_at?: string | null
          moderation_note?: string | null
          neighborhood?: string | null
          offered_at?: string | null
          owner_id?: string
          price?: number
          property_size?: number | null
          published_at?: string | null
          quality_score?: number | null
          reserved_for_user_id?: string | null
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["listing_status"] | null
          title?: string
          views_count?: number | null
          whatsapp_clicks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_ar: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          title_ar: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body_ar?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title_ar?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body_ar?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title_ar?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string | null
          expires_at: string
          id: string
          otp_hash: string | null
          phone: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          otp_hash?: string | null
          phone: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_hash?: string | null
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          total_listings: number | null
          total_responses: number | null
          updated_at: string | null
          verification_badge:
            | Database["public"]["Enums"]["verification_badge_status"]
            | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone: string
          role?: Database["public"]["Enums"]["user_role"]
          total_listings?: number | null
          total_responses?: number | null
          updated_at?: string | null
          verification_badge?:
            | Database["public"]["Enums"]["verification_badge_status"]
            | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          total_listings?: number | null
          total_responses?: number | null
          updated_at?: string | null
          verification_badge?:
            | Database["public"]["Enums"]["verification_badge_status"]
            | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      rentals: {
        Row: {
          broker_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          listing_id: string
          owner_id: string
          renter_id: string
          started_at: string
          status: Database["public"]["Enums"]["rental_status"]
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          owner_id: string
          renter_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["rental_status"]
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          owner_id?: string
          renter_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["rental_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"] | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_responses: {
        Row: {
          contact_phone: string | null
          contact_whatsapp: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          listing_id: string | null
          message: string
          request_id: string
          responder_id: string
        }
        Insert: {
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          listing_id?: string | null
          message: string
          request_id: string
          responder_id: string
        }
        Update: {
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          listing_id?: string | null
          message?: string
          request_id?: string
          responder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "housing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rated_user_id: string
          rater_id: string
          rating: number
          rental_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_user_id: string
          rater_id: string
          rating: number
          rental_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_user_id?: string
          rater_id?: string
          rating?: number
          rental_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ratings_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_applications: {
        Row: {
          applicant_id: string
          business_document_url: string | null
          created_at: string | null
          email: string | null
          id: string
          id_document_url: string | null
          notes: string | null
          review_note: string | null
          reviewed_by: string | null
          role: Database["public"]["Enums"]["verification_role"]
          status: Database["public"]["Enums"]["verification_app_status"] | null
        }
        Insert: {
          applicant_id: string
          business_document_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          id_document_url?: string | null
          notes?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          role: Database["public"]["Enums"]["verification_role"]
          status?: Database["public"]["Enums"]["verification_app_status"] | null
        }
        Update: {
          applicant_id?: string
          business_document_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          id_document_url?: string | null
          notes?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["verification_role"]
          status?: Database["public"]["Enums"]["verification_app_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_rateable_rentals: {
        Args: { p_rated: string; p_rater: string }
        Returns: {
          already_rated: boolean
          completed_at: string
          listing_id: string
          listing_title: string
          rental_id: string
        }[]
      }
      get_user_rating_stats: {
        Args: { p_user_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      increment_contact_clicks: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      increment_listing_views: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      increment_whatsapp_clicks: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      allowed_for_type: "family" | "bachelors" | "students" | "all"
      billing_period: "monthly" | "yearly" | "daily"
      for_whom_type: "family" | "bachelors" | "students"
      furnishing_preference: "any" | "furnished" | "unfurnished"
      furnishing_type: "furnished" | "semi_furnished" | "unfurnished"
      listing_category:
        | "room"
        | "apartment"
        | "house"
        | "floor"
        | "shop"
        | "office"
        | "shared"
        | "family"
        | "student"
      listing_status:
        | "draft"
        | "pending_review"
        | "active"
        | "paused"
        | "rented"
        | "expired"
        | "rejected"
        | "private_offer"
        | "reserved"
      notification_type:
        | "new_response"
        | "listing_expiring"
        | "listing_approved"
        | "listing_rejected"
        | "verification_update"
        | "new_report"
        | "system"
        | "new_message"
        | "private_offer_request"
        | "private_offer_created"
        | "private_offer_accepted"
        | "private_offer_rejected"
        | "rental_pending_review"
      rental_status: "active" | "completed" | "cancelled" | "pending_review"
      report_reason:
        | "fake"
        | "duplicate"
        | "inappropriate"
        | "spam"
        | "wrong_price"
        | "already_rented"
        | "other"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      report_target_type: "listing" | "user" | "request"
      request_status: "active" | "fulfilled" | "expired" | "cancelled"
      user_role: "renter" | "owner" | "broker" | "admin" | "moderator"
      verification_app_status: "pending" | "approved" | "rejected"
      verification_badge_status: "none" | "pending" | "verified" | "rejected"
      verification_role: "owner" | "broker" | "renter"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      allowed_for_type: ["family", "bachelors", "students", "all"],
      billing_period: ["monthly", "yearly", "daily"],
      for_whom_type: ["family", "bachelors", "students"],
      furnishing_preference: ["any", "furnished", "unfurnished"],
      furnishing_type: ["furnished", "semi_furnished", "unfurnished"],
      listing_category: [
        "room",
        "apartment",
        "house",
        "floor",
        "shop",
        "office",
        "shared",
        "family",
        "student",
      ],
      listing_status: [
        "draft",
        "pending_review",
        "active",
        "paused",
        "rented",
        "expired",
        "rejected",
        "private_offer",
        "reserved",
      ],
      notification_type: [
        "new_response",
        "listing_expiring",
        "listing_approved",
        "listing_rejected",
        "verification_update",
        "new_report",
        "system",
        "new_message",
        "private_offer_request",
        "private_offer_created",
        "private_offer_accepted",
        "private_offer_rejected",
        "rental_pending_review",
      ],
      rental_status: ["active", "completed", "cancelled", "pending_review"],
      report_reason: [
        "fake",
        "duplicate",
        "inappropriate",
        "spam",
        "wrong_price",
        "already_rented",
        "other",
      ],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      report_target_type: ["listing", "user", "request"],
      request_status: ["active", "fulfilled", "expired", "cancelled"],
      user_role: ["renter", "owner", "broker", "admin", "moderator"],
      verification_app_status: ["pending", "approved", "rejected"],
      verification_badge_status: ["none", "pending", "verified", "rejected"],
      verification_role: ["owner", "broker", "renter"],
    },
  },
} as const
