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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_trust_scores: {
        Row: {
          history_json: Json
          id: string
          score: number
          total_allowed: number
          total_blocked: number
          updated_at: string
          user_id: string
        }
        Insert: {
          history_json?: Json
          id?: string
          score?: number
          total_allowed?: number
          total_blocked?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          history_json?: Json
          id?: string
          score?: number
          total_allowed?: number
          total_blocked?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ciba_requests: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciba_requests_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connected_at: string
          id: string
          is_active: boolean | null
          provider: string
          provider_username: string | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          is_active?: boolean | null
          provider: string
          provider_username?: string | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          provider_username?: string | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      connected_account_secrets: {
        Row: {
          access_token_encrypted: string
          account_id: string
          auth0_user_id: string | null
          provider_user_id: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          account_id: string
          auth0_user_id?: string | null
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          account_id?: string
          auth0_user_id?: string | null
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_account_secrets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_log: {
        Row: {
          action: string
          block_reason: string | null
          block_type: string | null
          correlation_id: string | null
          id: string
          latency_ms: number | null
          mission_id: string
          params_json: Json | null
          result_json: Json | null
          result_summary: string | null
          status: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          block_reason?: string | null
          block_type?: string | null
          correlation_id?: string | null
          id?: string
          latency_ms?: number | null
          mission_id: string
          params_json?: Json | null
          result_json?: Json | null
          result_summary?: string | null
          status: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          block_reason?: string | null
          block_type?: string | null
          correlation_id?: string | null
          id?: string
          latency_ms?: number | null
          mission_id?: string
          params_json?: Json | null
          result_json?: Json | null
          result_summary?: string | null
          status?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_log_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_permissions: {
        Row: {
          action_type: string
          id: string
          mission_id: string
          provider: string
          reason: string | null
          scope: string
        }
        Insert: {
          action_type: string
          id?: string
          mission_id: string
          provider: string
          reason?: string | null
          scope: string
        }
        Update: {
          action_type?: string
          id?: string
          mission_id?: string
          provider?: string
          reason?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_permissions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          approved_at: string | null
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          intent_audit: Json | null
          manifest_json: Json | null
          objective: string
          policy_check: Json | null
          risk_level: string | null
          status: string
          tether_number: number
          time_limit_mins: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          intent_audit?: Json | null
          manifest_json?: Json | null
          objective: string
          policy_check?: Json | null
          risk_level?: string | null
          status?: string
          tether_number?: number
          time_limit_mins?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          intent_audit?: Json | null
          manifest_json?: Json | null
          objective?: string
          policy_check?: Json | null
          risk_level?: string | null
          status?: string
          tether_number?: number
          time_limit_mins?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          mission_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          mission_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          mission_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_rules: {
        Row: {
          id: string
          rules_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          rules_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          rules_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_nudges: {
        Row: {
          dismissed_ids: Json
          generated_at: string
          id: string
          nudges_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          dismissed_ids?: Json
          generated_at?: string
          id?: string
          nudges_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          dismissed_ids?: Json
          generated_at?: string
          id?: string
          nudges_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ambient_allowed_actions: Json
          ambient_budget_max: number
          ambient_budget_used: number
          ambient_budget_window_start: string | null
          ambient_enabled: boolean
          demo_mode: boolean
          id: string
          mcp_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ambient_allowed_actions?: Json
          ambient_budget_max?: number
          ambient_budget_used?: number
          ambient_budget_window_start?: string | null
          ambient_enabled?: boolean
          demo_mode?: boolean
          id?: string
          mcp_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ambient_allowed_actions?: Json
          ambient_budget_max?: number
          ambient_budget_used?: number
          ambient_budget_window_start?: string | null
          ambient_enabled?: boolean
          demo_mode?: boolean
          id?: string
          mcp_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
