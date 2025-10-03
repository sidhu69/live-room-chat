import { useState, useEffect, useRef } from "react";
import { Send, Search, Plus, ArrowLeft, MoreVertical, Users, UserPlus, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNavigation } from "@/components/rooms/BottomNavigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  message_type: string;
  read_at?: string;
}

interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  level: number;
  charms_total: number;
}

interface Contact {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  profile?: UserProfile;
}

export default function DirectMessages() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [searchUsername, setSearchUsername] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchContacts();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedContact && currentUser) {
      fetchMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [selectedContact, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchContacts = async () => {
    if (!currentUser) return;

    const { data: connections, error } = await supabase
      .from('user_connections')
      .select('*')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }

    const contactsWithProfiles = await Promise.all(
      connections.map(async (conn) => {
        const friendId = conn.user_id === currentUser.id ? conn.friend_id : conn.user_id;
        
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('user_id', friendId)
          .single();

        return {
          ...conn,
          friend_id: friendId,
          profile: profile as UserProfile
        };
      })
    );

    setContacts(contactsWithProfiles.filter(c => c.profile));
  };

  const searchUserByUsername = async () => {
    if (!searchUsername.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setSearchLoading(true);
    const { data, error } = await supabase.rpc('get_user_by_username_or_email', {
      input_text: searchUsername
    });

    setSearchLoading(false);

    if (error) {
      console.error('Search error:', error);
      toast({
        title: "Error",
        description: "Failed to search for user",
        variant: "destructive"
      });
      return;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      toast({
        title: "Not Found",
        description: "No user found with that username",
        variant: "destructive"
      });
      return;
    }

    const userData: any = Array.isArray(data) ? data[0] : data;
    
    // The function already returns all needed profile data
    const profile = {
      id: userData.user_id,
      user_id: userData.user_id,
      username: userData.username || '',
      display_name: userData.display_name || userData.username || '',
      avatar_url: userData.avatar_url || null,
      level: userData.level || 1,
      charms_total: userData.charms_total || 0,
      charms: 0,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    };

    setSearchedUser(profile);
    setShowAddContact(false);
    setShowUserProfile(true);
  };

  const startChat = async (friendId: string) => {
    if (!currentUser || !searchedUser) return;

    try {
      // Check if connection exists
      const { data: existing } = await supabase
        .from('user_connections')
        .select('*')
        .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUser.id})`)
        .single();

      let connectionId = existing?.id;

      if (!existing) {
        // Create connection with pending status
        const { data: newConnection, error } = await supabase
          .from('user_connections')
          .insert({
            user_id: currentUser.id,
            friend_id: friendId,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "Error",
            description: "Failed to start chat",
            variant: "destructive"
          });
          return;
        }
        connectionId = newConnection.id;
      }

      // Use the profile data we already have from searchedUser
      const profile: UserProfile = {
        user_id: searchedUser.user_id,
        username: searchedUser.username,
        display_name: searchedUser.display_name || searchedUser.username,
        avatar_url: searchedUser.avatar_url || '',
        level: searchedUser.level,
        charms_total: searchedUser.charms_total
      };

      // Create contact object
      const newContact: Contact = {
        id: connectionId || '',
        user_id: currentUser.id,
        friend_id: friendId,
        status: existing?.status || 'pending',
        profile: profile as UserProfile
      };

      // Close modal and open chat
      setShowUserProfile(false);
      setSearchUsername("");
      setSearchedUser(null);
      
      // Set selected contact to open chat
      setSelectedContact(newContact);
      
      // Refresh contacts list to show in sidebar
      await fetchContacts();

      toast({
        title: "Chat opened",
        description: existing?.status === 'accepted' 
          ? "You can now chat freely"
          : "Send a message to start the conversation"
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Error",
        description: "Failed to open chat",
        variant: "destructive"
      });
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!currentUser) return;

    const { data: existing } = await supabase
      .from('user_connections')
      .select('*')
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUser.id})`)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        toast({
          title: "Request Pending",
          description: "Friend request is awaiting response",
        });
      } else if (existing.status === 'accepted') {
        toast({
          title: "Already Friends",
          description: "You are already friends with this user",
        });
      }
      return;
    }

    const { error } = await supabase
      .from('user_connections')
      .insert({
        user_id: currentUser.id,
        friend_id: friendId,
        status: 'pending'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Friend Request Sent",
      description: "They will be notified of your request"
    });
    
    await fetchContacts();
    setShowUserProfile(false);
    setSearchUsername("");
  };

  const acceptFriendRequest = async (connectionId: string) => {
    const { error } = await supabase
      .from('user_connections')
      .update({ status: 'accepted' })
      .eq('id', connectionId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to accept friend request",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Friend Request Accepted",
      description: "You can now chat freely"
    });
    
    fetchContacts();
  };

  const rejectFriendRequest = async (connectionId: string) => {
    const { error } = await supabase
      .from('user_connections')
      .update({ status: 'rejected' })
      .eq('id', connectionId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject friend request",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Friend Request Rejected"
    });
    
    fetchContacts();
  };

  const fetchMessages = async () => {
    if (!selectedContact || !currentUser) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.friend_id}),and(sender_id.eq.${selectedContact.friend_id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
    
    // Count messages sent by current user
    const sentCount = data?.filter(m => m.sender_id === currentUser.id).length || 0;
    setMessageCount(sentCount);
  };

  const setupRealtimeSubscription = () => {
    if (!selectedContact || !currentUser) return;

    const channel = supabase
      .channel(`dm_${currentUser.id}_${selectedContact.friend_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages'
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if message is relevant to this conversation
          if ((newMsg.sender_id === currentUser.id && newMsg.receiver_id === selectedContact.friend_id) ||
              (newMsg.sender_id === selectedContact.friend_id && newMsg.receiver_id === currentUser.id)) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUser) return;

    // Check if friend request is still pending and message limit
    if (selectedContact.status === 'pending' && messageCount >= 1) {
      toast({
        title: "Message Limit Reached",
        description: "Wait for the user to accept your friend request to send more messages",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: selectedContact.friend_id,
        content: newMessage,
        message_type: 'text'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
      return;
    }

    setNewMessage("");
    setMessageCount(prev => prev + 1);
    
    toast({
      title: "Message sent",
      description: selectedContact.status === 'pending' && messageCount === 0 
        ? "Wait for the user to accept your friend request to send more messages"
        : "Your message has been delivered"
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Contacts Sidebar - Hide when chat is open on mobile */}
        <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-border bg-card flex-col`}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Messages</h2>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowAddContact(true)}
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {contacts.length > 0 ? (
              <div>
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 cursor-pointer border-b border-border ${
                      selectedContact?.id === contact.id 
                        ? "bg-accent" 
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={contact.profile?.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {contact.profile?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {contact.profile?.username || 'Unknown User'}
                          </p>
                          {contact.status === 'pending' && (
                            <Badge variant="secondary" className="text-xs">
                              {contact.user_id === currentUser?.id ? 'Sent' : 'Request'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.status === 'pending' && contact.friend_id === currentUser?.id 
                            ? 'Tap to accept/reject' 
                            : 'Online'}
                        </p>
                      </div>
                      {contact.status === 'pending' && contact.friend_id === currentUser?.id && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => acceptFriendRequest(contact.id)}
                            className="h-8 w-8 p-0"
                          >
                            <UserCheck className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectFriendRequest(contact.id)}
                            className="h-8 w-8 p-0"
                          >
                            <UserX className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No contacts yet</h3>
                <p className="text-muted-foreground text-sm">
                  Tap the search icon to find users and start chatting
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area - Full screen when selected on mobile */}
        <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="md:hidden"
                      onClick={() => setSelectedContact(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedContact.profile?.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {selectedContact.profile?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {selectedContact.profile?.username}
                      </h3>
                      <p className="text-sm text-muted-foreground">Online</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === currentUser?.id ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender_id === currentUser?.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-foreground"
                      }`}
                    >
                      <p className="text-sm break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_id === currentUser?.id 
                          ? "opacity-70" 
                          : "text-muted-foreground"
                      }`}>
                        {new Date(message.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card">
                {selectedContact.status === 'pending' && messageCount >= 1 && (
                  <p className="text-xs text-muted-foreground mb-2 text-center">
                    Wait for friend request acceptance to send more messages
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                    disabled={selectedContact.status === 'pending' && messageCount >= 1}
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || (selectedContact.status === 'pending' && messageCount >= 1)}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Conversation Selected</h2>
              <p className="text-muted-foreground max-w-md">
                Select a contact to start chatting
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search User Modal */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search User</DialogTitle>
            <DialogDescription>
              Enter a username to search for users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Input
                placeholder="Enter username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchUsername.trim()) {
                    searchUserByUsername();
                  }
                }}
              />
            </div>
            <Button
              onClick={searchUserByUsername}
              disabled={searchLoading || !searchUsername.trim()}
              className="w-full"
            >
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {searchedUser && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={searchedUser.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {searchedUser.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">{searchedUser.username}</h3>
                  <p className="text-sm text-muted-foreground">{searchedUser.display_name}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-semibold">Level {searchedUser.level}</p>
                    <p className="text-muted-foreground">Level</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{searchedUser.charms_total}</p>
                    <p className="text-muted-foreground">Charms</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => startChat(searchedUser.user_id)}
                  className="flex-1"
                  variant="default"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Message
                </Button>
                <Button
                  onClick={() => sendFriendRequest(searchedUser.user_id)}
                  className="flex-1"
                  variant="outline"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Friend
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
}
