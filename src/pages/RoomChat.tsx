import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRooms } from "@/hooks/useRooms";
import { motion } from "framer-motion";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  room_id: string;
}

const MAX_MESSAGE_LENGTH = 1000;

const RoomChat = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { leaveRoom } = useRooms();

  const [roomName, setRoomName] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // SEO: update title
  useEffect(() => {
    document.title = roomName ? `${roomName} | Chat Room` : "Room Chat";
  }, [roomName]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadRoomAndMessages = async () => {
      if (!roomId) return;
      setLoading(true);
      // Fetch room details (RLS: public rooms or where user is a member)
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .select("id,name,is_public")
        .eq("id", roomId)
        .single();

      if (roomErr || !room) {
        setLoading(false);
        return;
      }
      setRoomName(room.name);
      setIsPublic(room.is_public);

      // Fetch initial messages
      const { data: msgs } = await supabase
        .from("room_messages")
        .select("id, content, created_at, user_id, room_id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
      setLoading(false);
      scrollToBottom();

      // Realtime subscription for new messages
      const channel = supabase
        .channel(`room_messages_${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
            scrollToBottom();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = loadRoomAndMessages();
    return () => {
      // ensure cleanup subscription
      if (typeof cleanup === "function") (cleanup as any)();
    };
  }, [roomId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) return;
    if (!roomId) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("room_messages").insert({
        content: text,
        message_type: "text",
        user_id: user.id,
        room_id: roomId,
      });
      if (!error) setInput("");
    } finally {
      setSending(false);
    }
  };

  const handleLeave = async () => {
    if (!roomId) return;
    const ok = await leaveRoom(roomId);
    if (ok) navigate("/rooms");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-room-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-semibold text-foreground">{roomName || "Room"}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/rooms')}>Back</Button>
            <Button variant="destructive" onClick={handleLeave}>Leave</Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-card border border-border"
            >
              <div className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</div>
              <div className="text-foreground">{m.content}</div>
            </motion.div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isPublic ? "Message public room" : "Message private room"}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Button onClick={sendMessage} disabled={sending}>Send</Button>
        </div>
      </div>
    </div>
  );
};

export default RoomChat;
