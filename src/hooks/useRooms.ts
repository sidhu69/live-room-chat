import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Room {
  id: string;
  name: string;
  code: string;
  is_public: boolean;
  creator_id: string;
  active_members: number;
  max_members: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
}

export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch public rooms
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching rooms:", error);
        setError("Failed to load rooms");
        toast({
          title: "Error",
          description: "Failed to load rooms",
          variant: "destructive",
        });
        return;
      }

      setRooms(data || []);
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create room
  const createRoom = useCallback(async (name: string, isPublic: boolean = true) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to create a room",
          variant: "destructive",
        });
        return null;
      }

      const response = await supabase.functions.invoke("create-room", {
        body: { name, isPublic },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Create room error:", response.error);
        toast({
          title: "Error",
          description: "Failed to create room",
          variant: "destructive",
        });
        return null;
      }

      const { room } = response.data;
      
      // Update local state if it's a public room
      if (room.is_public) {
        setRooms(prev => [room, ...prev]);
      }

      toast({
        title: "Room created!",
        description: `Room "${room.name}" created successfully`,
      });

      return room;
    } catch (error) {
      console.error("Create room error:", error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Join room by code
  const joinRoom = useCallback(async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to join a room",
          variant: "destructive",
        });
        return null;
      }

      const response = await supabase.functions.invoke("join-room", {
        body: { code },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Join room error:", response.error);
        toast({
          title: "Error",
          description: response.data?.error || "Failed to join room",
          variant: "destructive",
        });
        return null;
      }

      const { room } = response.data;

      toast({
        title: "Successfully joined!",
        description: `You joined "${room.name}"`,
      });

      return room;
    } catch (error) {
      console.error("Join room error:", error);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Leave room
  const leaveRoom = useCallback(async (roomId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to leave the room",
          variant: "destructive",
        });
        return false;
      }

      const response = await supabase.functions.invoke("leave-room", {
        body: { roomId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Leave room error:", response.error);
        toast({
          title: "Error",
          description: "Failed to leave room",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Left room",
        description: "You have left the room",
      });

      return true;
    } catch (error) {
      console.error("Leave room error:", error);
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    fetchRooms();

    // Subscribe to room changes
    const roomsChannel = supabase
      .channel("public:rooms")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: "is_public=eq.true",
        },
        (payload) => {
          console.log("Room change:", payload);
          
          if (payload.eventType === "INSERT") {
            setRooms(prev => [payload.new as Room, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRooms(prev => 
              prev.map(room => 
                room.id === payload.new.id ? { ...room, ...payload.new } : room
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRooms(prev => prev.filter(room => room.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    refreshRooms: fetchRooms,
  };
};