import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { toast } from "@/components/ui/use-toast";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  });
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[useAuth] Setting up auth listener');
    
    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] Initial session check:', !!session);
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      });
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth state change:', event, 'Session:', !!session);
        
        // Only synchronous state updates here
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false
        });

        // Defer async operations to prevent deadlock
        if (event === 'SIGNED_IN' && session) {
          setTimeout(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('onboarding_completed')
              .eq('user_id', session.user.id)
              .single();

            if (!profile?.onboarding_completed) {
              navigate('/your-name');
            } else {
              navigate('/');
            }
          }, 0);
        }

        if (event === 'SIGNED_OUT') {
          setTimeout(() => navigate('/login'), 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const register = async (username: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: username.toLowerCase()
          }
        }
      });

      if (error) throw error;

      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "Please verify your email address to complete registration"
        });
        return;
      }

      // Create profile record
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              user_id: data.user.id,
              username: username.toLowerCase(),
              email,
              onboarding_completed: false
            }
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error('Failed to create user profile');
        }
      }

      navigate('/your-name');
    } catch (error: any) {
      if (error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('username')) {
          throw new Error('Username already taken');
        } else if (error.message.includes('email')) {
          throw new Error('Email already registered');
        }
      }
      throw error;
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      // First, try to find user by username or email
      const { data: userData } = await supabase.rpc('get_user_by_username_or_email', {
        input_text: identifier
      });

      let email = identifier;
      if (userData && userData.length > 0) {
        email = userData[0].email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Store session for biometric login
      if (data.session) {
        await Preferences.set({
          key: 'biometric_session',
          value: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at
          })
        });
      }

      // Check if fingerprint is enabled and ask user
      const { data: profile } = await supabase
        .from('profiles')
        .select('fingerprint_enabled')
        .eq('user_id', data.user.id)
        .single();

      if (!profile?.fingerprint_enabled) {
        // Ask user if they want to enable fingerprint login
        setTimeout(() => {
          const enableFingerprint = window.confirm(
            "Would you like to enable fingerprint login for faster access next time?"
          );
          if (enableFingerprint) {
            enableBiometric();
          }
        }, 2000);
      }

    } catch (error: any) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid username/email or password');
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) throw error;
  };

  const updateDisplayName = async (displayName: string) => {
    if (!authState.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', authState.user.id);

    if (error) throw error;

    navigate('/pfp-upload');
  };

  const uploadAvatar = async (file: File) => {
    if (!authState.user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const filePath = `${authState.user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('user_id', authState.user.id);

    if (updateError) throw updateError;
  };

  const completeOnboarding = async () => {
    if (!authState.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', authState.user.id);

    if (error) throw error;

    navigate('/');
  };

  const enableBiometric = async () => {
    if (!authState.user) throw new Error('Not authenticated');

    try {
      // Update profile to mark fingerprint as enabled
      const { error } = await supabase
        .from('profiles')
        .update({ fingerprint_enabled: true })
        .eq('user_id', authState.user.id);

      if (error) throw error;

      toast({
        title: "Fingerprint login enabled",
        description: "You can now use your fingerprint to sign in"
      });
    } catch (error) {
      console.error('Error enabling biometric:', error);
    }
  };

  const checkBiometric = async (): Promise<boolean> => {
    try {
      // Check if we have a stored session
      const { value } = await Preferences.get({ key: 'biometric_session' });
      return !!value;
    } catch (error) {
      return false;
    }
  };

  const loginWithBiometric = async () => {
    try {
      const { value } = await Preferences.get({ key: 'biometric_session' });
      
      if (!value) {
        throw new Error('No biometric session found');
      }

      const sessionData = JSON.parse(value);
      
      // Restore session with stored tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });

      if (error) throw error;

      navigate('/');
    } catch (error) {
      // Clear invalid session
      await Preferences.remove({ key: 'biometric_session' });
      throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await Preferences.remove({ key: 'biometric_session' });
  };

  return {
    ...authState,
    register,
    login,
    logout,
    resetPassword,
    updateDisplayName,
    uploadAvatar,
    completeOnboarding,
    enableBiometric,
    checkBiometric,
    loginWithBiometric
  };
};