export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attributes: {
        Row: {
          archived_at: string | null
          created_at: string
          group_id: string
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          precision: number
          sort_order: number
          unit: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          precision?: number
          sort_order?: number
          unit?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          precision?: number
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'attributes_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
        ]
      }
      entries: {
        Row: {
          attribute_id: string
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          measured_at: string
          subject_id: string
          updated_at: string | null
          updated_by: string | null
          value: number
        }
        ComputedFields: never
        Insert: {
          attribute_id: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          measured_at: string
          subject_id: string
          updated_at?: string | null
          updated_by?: string | null
          value: number
        }
        Update: {
          attribute_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          measured_at?: string
          subject_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'entries_attribute_id_fkey'
            columns: ['attribute_id']
            isOneToOne: false
            referencedRelation: 'attributes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          created_at: string
          default_for_user_id: string | null
          description: string | null
          ends_on: string | null
          id: string
          members_edit_own_subject_only: boolean
          name: string
          starts_on: string | null
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_for_user_id?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          members_edit_own_subject_only?: boolean
          name: string
          starts_on?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_for_user_id?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          members_edit_own_subject_only?: boolean
          name?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'groups_default_for_user_id_fkey'
            columns: ['default_for_user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          group_id: string
          id: string
          revoked_at: string | null
          role: Database['public']['Enums']['group_role']
          token: string
          invite_status: string | null
        }
        ComputedFields: 'invite_status'
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at: string
          group_id: string
          id?: string
          revoked_at?: string | null
          role: Database['public']['Enums']['group_role']
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          group_id?: string
          id?: string
          revoked_at?: string | null
          role?: Database['public']['Enums']['group_role']
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invites_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          group_id: string
          role: Database['public']['Enums']['group_role']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          group_id: string
          role: Database['public']['Enums']['group_role']
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: Database['public']['Enums']['group_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      subject_link_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          group_id: string
          id: string
          status: Database['public']['Enums']['link_request_status']
          subject_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          id?: string
          status?: Database['public']['Enums']['link_request_status']
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          id?: string
          status?: Database['public']['Enums']['link_request_status']
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subject_link_requests_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subject_link_requests_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subject_link_requests_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subject_link_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      subjects: {
        Row: {
          archived_at: string | null
          birthdate: string | null
          color: Database['public']['Enums']['subject_color']
          created_at: string
          group_id: string
          id: string
          linked_user_id: string | null
          name: string
          name_customized: boolean
          visibility_frozen: boolean
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          birthdate?: string | null
          color: Database['public']['Enums']['subject_color']
          created_at?: string
          group_id: string
          id?: string
          linked_user_id?: string | null
          name: string
          name_customized?: boolean
          visibility_frozen?: boolean
        }
        Update: {
          archived_at?: string | null
          birthdate?: string | null
          color?: Database['public']['Enums']['subject_color']
          created_at?: string
          group_id?: string
          id?: string
          linked_user_id?: string | null
          name?: string
          name_customized?: boolean
          visibility_frozen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'subjects_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subjects_linked_user_id_fkey'
            columns: ['linked_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      value_visibility: {
        Row: {
          attribute_id: string
          subject_id: string
          updated_at: string
          visibility: Database['public']['Enums']['value_visibility_mode']
        }
        ComputedFields: never
        Insert: {
          attribute_id: string
          subject_id: string
          updated_at?: string
          visibility: Database['public']['Enums']['value_visibility_mode']
        }
        Update: {
          attribute_id?: string
          subject_id?: string
          updated_at?: string
          visibility?: Database['public']['Enums']['value_visibility_mode']
        }
        Relationships: [
          {
            foreignKeyName: 'value_visibility_attribute_id_fkey'
            columns: ['attribute_id']
            isOneToOne: false
            referencedRelation: 'attributes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'value_visibility_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: {
          choice: string
          invite_token: string
          request_subject_id?: string
        }
        Returns: string
      }
      attribute_entry_count: {
        Args: { target_attribute_id: string }
        Returns: number
      }
      attribute_has_entries: {
        Args: { target_attribute_id: string }
        Returns: boolean
      }
      can_see_values: {
        Args: { target_attribute_id: string; target_subject_id: string }
        Returns: boolean
      }
      can_set_visibility: {
        Args: { target_subject_id: string }
        Returns: boolean
      }
      can_write_entry: {
        Args: { target_attribute_id: string; target_subject_id: string }
        Returns: boolean
      }
      can_write_subject: {
        Args: { target_subject_id: string }
        Returns: boolean
      }
      change_member_role: {
        Args: {
          new_role: Database['public']['Enums']['group_role']
          target_group_id: string
          target_user_id: string
        }
        Returns: undefined
      }
      decide_link_request: {
        Args: { approve: boolean; request_id: string }
        Returns: undefined
      }
      get_dashboard: {
        Args: { target_group_id: string }
        Returns: {
          attribute_id: string
          change_since_first: number
          change_since_previous: number
          entry_count: number
          first_at: string
          first_value: number
          latest_at: string
          latest_value: number
          pct_since_first: number
          pct_since_previous: number
          previous_at: string
          previous_value: number
          subject_id: string
        }[]
      }
      get_entry_rows: {
        Args: {
          attribute_filter?: string
          page_offset?: number
          page_size?: number
          sort?: string
          subject_filter?: string
          target_group_id: string
        }
        Returns: {
          attribute_id: string
          comment: string
          created_at: string
          creator_name: string
          entry_id: string
          measured_at: string
          pct_change: number
          subject_id: string
          total_count: number
          updated_at: string
          updater_name: string
          value: number
        }[]
      }
      get_invite_preview: {
        Args: { invite_token: string }
        Returns: {
          already_member: boolean
          expires_at: string
          group_id: string
          group_name: string
          invite_email: string
          inviter_name: string
          role: Database['public']['Enums']['group_role']
          status: string
          subjects: Json
        }[]
      }
      get_series: {
        Args: {
          baseline?: string
          from_at?: string
          max_points?: number
          target_group_id: string
          to_at?: string
        }
        Returns: {
          attribute_id: string
          change: number
          comment: string
          entry_count: number
          entry_id: string
          measured_at: string
          pct_change: number
          subject_id: string
          value: number
        }[]
      }
      invite_status: {
        Args: {
          invite: Omit<
            Database['public']['Tables']['invites']['Row'],
            Database['public']['Tables']['invites']['ComputedFields']
          >
        }
        Returns: string
      }
      is_member: { Args: { target_group_id: string }; Returns: boolean }
      leave_group: {
        Args: { keep_entries: boolean; target_group_id: string }
        Returns: undefined
      }
      member_role: {
        Args: { target_group_id: string }
        Returns: Database['public']['Enums']['group_role']
      }
      release_member_subject: {
        Args: {
          keep_entries: boolean
          target_group_id: string
          target_user_id: string
        }
        Returns: undefined
      }
      remove_member: {
        Args: { target_group_id: string; target_user_id: string }
        Returns: undefined
      }
      reorder_attributes: {
        Args: { attribute_ids: string[]; target_group_id: string }
        Returns: undefined
      }
      shares_group_with: { Args: { target_user_id: string }; Returns: boolean }
      subject_group_id: { Args: { target_subject_id: string }; Returns: string }
      transfer_ownership: {
        Args: { new_owner_id: string; target_group_id: string }
        Returns: undefined
      }
      visibility_of: {
        Args: { target_attribute_id: string; target_subject_id: string }
        Returns: string
      }
    }
    Enums: {
      group_role: 'owner' | 'editor' | 'viewer'
      link_request_status: 'pending' | 'approved' | 'rejected'
      subject_color:
        | 'blue'
        | 'orange'
        | 'aqua'
        | 'yellow'
        | 'magenta'
        | 'green'
        | 'violet'
        | 'red'
      value_visibility_mode: 'absolute' | 'relative'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      group_role: ['owner', 'editor', 'viewer'],
      link_request_status: ['pending', 'approved', 'rejected'],
      subject_color: [
        'blue',
        'orange',
        'aqua',
        'yellow',
        'magenta',
        'green',
        'violet',
        'red',
      ],
      value_visibility_mode: ['absolute', 'relative'],
    },
  },
} as const
