import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
          setIsApproved(false);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error getting session:', err);
        setLoading(false);
      }
    };

    // Call getSession and ensure loading is set to false within 5 seconds
    getSession();
    const timeout = setTimeout(() => {
      console.warn('Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
          setIsApproved(false);
        }
        setLoading(false);
        clearTimeout(timeout);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchUserRole = async (userId) => {
    try {
      console.log('🔍 Fetching role for userId:', userId);
      const { data, error } = await supabase
        .from('pilots')
        .select('role, is_approved')
        .eq('user_id', userId)
        .single();

      console.log('📊 Role query result:', { data, error });

      if (error) {
        console.log('❌ No role assigned yet:', error.message);
        // Don't set fallback role, let it be null
        setUserRole(null);
        setIsApproved(false);
        return;
      }

      console.log('✅ Role found:', data?.role, 'Approved:', data?.is_approved);
      setUserRole(data?.role || 'user');
      setIsApproved(data?.is_approved || false);
    } catch (err) {
      console.error('💥 Error fetching user role:', err);
      // Fallback: allow authenticated user to proceed
      setUserRole('user');
      setIsApproved(true);
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('Attempting login with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Supabase auth error:', error);
        throw new Error(error.message || 'Authentication failed');
      }
      
      if (data.user) {
        await fetchUserRole(data.user.id);
      }
      
      return data;
    } catch (err) {
      console.error('Sign in error:', err);
      throw new Error(err.message || 'Login failed. Please check your credentials and try again.');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        throw error;
      }
      setUser(null);
      setUserRole(null);
      setIsApproved(false);
    } catch (err) {
      console.error('Sign out failed:', err);
      // Force state reset even if logout fails
      setUser(null);
      setUserRole(null);
      setIsApproved(false);
      throw err;
    }
  };

  const logout = signOut;

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const hasRole = (requiredRoles) => {
    if (!userRole || !isApproved) return false;
    // 'user' is fallback role - only allow for pages that don't specify requiredRoles
    // For protected routes with specific role requirements, check actual roles
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(userRole);
    }
    return userRole === requiredRoles;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        isApproved,
        loading,
        signIn,
        signOut,
        logout,
        resetPassword,
        updatePassword,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
