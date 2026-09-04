export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      members: {
        Row: {
          display_name: string
          id: string
          is_host: boolean
          joined_at: string
          neins_cast: number
          points: number
          room_id: string
          songs_added: number
          songs_kept: number
          songs_skipped: number
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          is_host?: boolean
          joined_at?: string
          neins_cast?: number
          points?: number
          room_id: string
          songs_added?: number
          songs_kept?: number
          songs_skipped?: number
          user_id: string
        }
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>
        Relationships: []
      }
      queue_items: {
        Row: {
          added_by: string | null
          artist: string
          audio_started_at: string | null
          created_at: string
          paused_at: string | null
          paused_ms: number
          duration_s: number
          id: string
          locked: boolean
          position: number
          room_id: string
          status: string
          thumb_url: string | null
          title: string
          video_id: string
        }
        Insert: {
          added_by?: string | null
          artist: string
          audio_started_at?: string | null
          created_at?: string
          paused_at?: string | null
          paused_ms?: number
          duration_s: number
          id?: string
          locked?: boolean
          position: number
          room_id: string
          status?: string
          thumb_url?: string | null
          title: string
          video_id: string
        }
        Update: Partial<Database["public"]["Tables"]["queue_items"]["Insert"]>
        Relationships: []
      }
      rooms: {
        Row: {
          ahoy_lock: boolean
          code: string
          created_at: string
          host_id: string
          id: string
          last_verdict: string | null
          last_verdict_at: string | null
          name: string
          now_playing_id: string | null
          skip_rule: string
          started_at: string | null
          last_active_at: string
          retired_at: string | null
        }
        Insert: {
          ahoy_lock?: boolean
          code: string
          created_at?: string
          host_id: string
          id?: string
          last_verdict?: string | null
          last_verdict_at?: string | null
          name: string
          now_playing_id?: string | null
          skip_rule?: string
          started_at?: string | null
          last_active_at?: string
          retired_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>
        Relationships: []
      }
      search_cache: {
        Row: {
          created_at: string
          query: string
          results: Json
        }
        Insert: {
          created_at?: string
          query: string
          results: Json
        }
        Update: Partial<Database["public"]["Tables"]["search_cache"]["Insert"]>
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          member_id: string
          queue_item_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          member_id: string
          queue_item_id: string
          updated_at?: string
          value: string
        }
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_to_queue: {
        Args: {
          p_artist: string
          p_duration_s: number
          p_room_id: string
          p_thumb_url: string | null
          p_title: string
          p_video_id: string
        }
        Returns: Database["public"]["Tables"]["queue_items"]["Row"]
      }
      cast_vote: {
        Args: { p_queue_item_id: string; p_room_id: string; p_value: string }
        Returns: undefined
      }
      clear_verdict: { Args: { p_room_id: string }; Returns: undefined }
      create_room: {
        Args: { p_name: string; p_skip_rule?: string }
        Returns: Database["public"]["Tables"]["rooms"]["Row"]
      }
      host_skip: { Args: { p_room_id: string; p_queue_item_id?: string }; Returns: undefined }
      leave_room: { Args: { p_room_id: string }; Returns: undefined }
      join_room: {
        Args: { p_code: string; p_display_name: string }
        Returns: Database["public"]["Tables"]["rooms"]["Row"]
      }
      mark_now_playing_finished: {
        Args: { p_room_id: string; p_queue_item_id?: string }
        Returns: undefined
      }
      mark_playback_started: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      pause_playback: {
        Args: { p_room_id: string; p_queue_item_id: string }
        Returns: undefined
      }
      resume_playback: {
        Args: { p_room_id: string; p_queue_item_id: string }
        Returns: undefined
      }
      remove_from_queue: {
        Args: { p_queue_item_id: string; p_room_id: string }
        Returns: undefined
      }
      remove_member: {
        Args: { p_member_id: string; p_room_id: string }
        Returns: undefined
      }
      update_room_settings: {
        Args: { p_ahoy_lock: boolean; p_room_id: string; p_skip_rule: string }
        Returns: Database["public"]["Tables"]["rooms"]["Row"]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
