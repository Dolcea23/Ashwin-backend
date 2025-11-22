import React, { createContext, ReactNode, useContext, useState } from "react";

type SleepSession = {
  heartRate?: number;
  temperatureF?: number;
  calmness?: number;
  timestamp: number;
};

type UserProfile = {
  name?: string;
  age?: number;
  bodyType?: string;
  sleepStyle?: "side" | "back" | "stomach";
};

type ContextType = {
  profile: UserProfile;
  setProfile: (p: Partial<UserProfile>) => void;
  sessions: SleepSession[];
  logSleepSession: (s: SleepSession) => void;
};

const UserContext = createContext<ContextType | undefined>(undefined);

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfileState] = useState<UserProfile>({});
  const [sessions, setSessions] = useState<SleepSession[]>([]);

  const setProfile = (p: Partial<UserProfile>) => {
    setProfileState(prev => ({ ...prev, ...p }));
  };

  const logSleepSession = (s: SleepSession) => {
    setSessions(prev => [...prev, s]);
    console.log("Session logged:", s);
  };

  return (
    <UserContext.Provider value={{ profile, setProfile, sessions, logSleepSession }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
