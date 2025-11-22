// src/utils/auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "ASHWIN_AUTH_SESSION";

type Session = {
  userId: string;
  email: string;
  name?: string;
  firstLogin?: boolean; // used to decide if we send them to questionnaire
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function signUp(name: string, email: string, password: string) {
  // TODO: replace with your backend call
  await wait(600);
  const session: Session = {
    userId: `user_${Date.now()}`,
    email,
    name,
    firstLogin: true,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signIn(email: string, password: string) {
  // TODO: replace with your backend call
  await wait(500);
  // Mock: if a session exists, reuse it; else create one
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) {
    const parsed: Session = JSON.parse(existing);
    // Returning user — clear firstLogin if it lingers
    const updated = { ...parsed, firstLogin: false };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return updated;
  }
  const session: Session = { userId: `user_${Date.now()}`, email, firstLogin: false };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signOut() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<Session | null> {
  const s = await AsyncStorage.getItem(SESSION_KEY);
  return s ? JSON.parse(s) : null;
}
