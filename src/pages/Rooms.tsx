import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/rooms/BottomNavigation";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { JoinRoomModal } from "@/components/rooms/JoinRoomModal";
import { useRooms } from "@/hooks/useRooms";
import { useNavigate } from "react-router-dom";
const Rooms = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const { rooms, loading, joinRoom } = useRooms();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between p-4">
          <motion.h1 
            className="text-2xl font-bold bg-gradient-to-r from-room-primary to-room-primary-glow bg-clip-text text-transparent"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            Rooms
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Users className="w-6 h-6 text-room-primary" />
          </motion.div>
        </div>
      </motion.div>

      {/* Main Actions */}
      <div className="p-4 space-y-4">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-24 bg-gradient-to-r from-room-primary to-room-primary-glow hover:shadow-lg transition-all duration-200 group"
            size="lg"
          >
            <div className="flex flex-col items-center space-y-2">
              <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">Create Room</span>
            </div>
          </Button>

          <Button
            onClick={() => setShowJoinModal(true)}
            variant="outline"
            className="h-24 border-2 border-room-primary/20 hover:border-room-primary/40 hover:bg-room-primary/5 transition-all duration-200 group"
            size="lg"
          >
            <div className="flex flex-col items-center space-y-2">
              <Hash className="w-8 h-8 text-room-primary group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-room-primary">Join Room</span>
            </div>
          </Button>
        </motion.div>
      </div>

      {/* Public Rooms List */}
      <div className="p-4">
        <motion.h2
          className="text-lg font-semibold mb-4 text-foreground"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          Public Rooms
        </motion.h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-room-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No public rooms</h3>
            <p className="text-muted-foreground">Be the first to create a public room!</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {rooms.map((room, index) => (
              <motion.div
                key={room.id}
                className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-all duration-200"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{room.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {room.active_members} / {room.max_members} members
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-room-primary hover:bg-room-primary/90"
                    onClick={async () => {
                      const joined = await joinRoom(room.code);
                      if (joined) navigate(`/rooms/${room.id}`);
                    }}
                  >
                    Join
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(room) => {
          setShowCreateModal(false);
          navigate(`/rooms/${room.id}`);
        }}
      />

      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={(room) => {
          setShowJoinModal(false);
          navigate(`/rooms/${room.id}`);
        }}
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Rooms;