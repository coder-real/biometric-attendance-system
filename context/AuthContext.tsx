import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import type { AuthContextType, AdminData } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const adminDocRef = doc(db, 'admins', user.uid);
          const adminDocSnap = await getDoc(adminDocRef);
          
          if (adminDocSnap.exists()) {
            setAdminData(adminDocSnap.data() as AdminData);
          } else {
            // No specific admin data, create a default from user object
            setAdminData({
                name: user.displayName || 'Admin',
                role: 'Administrator',
                email: user.email || 'No email'
            });
          }
        } catch (error) {
          console.error("Failed to fetch admin data:", error);
          setAdminData(null);
        }
      } else {
        setAdminData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    adminData,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
