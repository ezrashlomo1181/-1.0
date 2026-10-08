import { UserProfile } from '../types/financial';

const USERS_STORAGE_KEY = 'matzpen_local_users_db';
const ACTIVE_SESSION_KEY = 'matzpen_active_user_session';

export interface LocalUserRecord {
  id: string;
  username: string;
  name?: string;
  email?: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  lastLogin: string;
  onboardingCompleted: boolean;
  financialProfileCompletion: number;
  accountStatus: 'active' | 'deactivated';
  deletionStatus: 'none' | 'pending_deletion';
  deletionRequestedAt: string | null;
  scheduledDeletionDate: string | null;
}

// Simple deterministic hash with salt for secure local password comparison
async function hashPassword(password: string, salt: string): Promise<string> {
  const combined = `${salt}:${password}:matzpen_local_secret`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(combined);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  // Fallback simple hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}`;
}

function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(8);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2, 10);
}

// Load all registered users from local storage
export function getStoredLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse local users db:', e);
  }
  return [];
}

// Save all registered users to local storage
function saveStoredLocalUsers(users: LocalUserRecord[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save local users db:', e);
  }
}

// Convert record to UserProfile
function toUserProfile(record: LocalUserRecord): UserProfile {
  const username = record.username || record.name || 'משתמש';
  return {
    id: record.id,
    username,
    name: record.name || username,
    email: record.email,
    authProvider: 'password',
    createdAt: record.createdAt,
    lastLogin: record.lastLogin,
    role: 'user',
    accountStatus: record.accountStatus,
    deletionStatus: record.deletionStatus,
    deletionRequestedAt: record.deletionRequestedAt,
    scheduledDeletionDate: record.scheduledDeletionDate,
    financialProfileCompletion: record.financialProfileCompletion || 20,
    onboardingCompleted: record.onboardingCompleted,
  };
}

// Auth state listeners
type AuthListener = (user: UserProfile | null) => void;
const authListeners: Set<AuthListener> = new Set();

export function subscribeToLocalAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  // Emit current user immediately
  const current = getCurrentLocalUser();
  listener(current);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuthListeners(): void {
  const current = getCurrentLocalUser();
  authListeners.forEach((fn) => {
    try {
      fn(current);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

// Get the currently logged in local user
export function getCurrentLocalUser(): UserProfile | null {
  try {
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeId) return null;

    const users = getStoredLocalUsers();
    const user = users.find((u) => u.id === activeId);
    if (user) {
      return toUserProfile(user);
    }
  } catch (e) {
    console.warn('Error getting current local user:', e);
  }
  return null;
}

// Local Registration
export async function registerLocalUser(
  username: string,
  password: string,
  confirmPassword: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const trimmedUsername = username.trim();

  // 1. Validations
  if (!trimmedUsername) {
    return { success: false, error: 'אנא הזן שם משתמש.' };
  }
  if (trimmedUsername.length < 2) {
    return { success: false, error: 'שם המשתמש חייב להכיל לפחות 2 תווים.' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'הסיסמה חייבת להכיל לפחות 4 תווים.' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'הסיסמאות אינן תואמות. אנא נסה שוב.' };
  }

  // 2. Uniqueness check
  const users = getStoredLocalUsers();
  const existing = users.find(
    (u) => (u.username || u.name || '').toLowerCase() === trimmedUsername.toLowerCase()
  );
  if (existing) {
    return {
      success: false,
      error: 'שם משתמש זה כבר רשום במערכת במחשב זה. אנא בחר שם אחר או התחבר.',
    };
  }

  // 3. Create user record
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newRecord: LocalUserRecord = {
    id: userId,
    username: trimmedUsername,
    name: trimmedUsername,
    passwordHash,
    salt,
    createdAt: now,
    lastLogin: now,
    onboardingCompleted: false,
    financialProfileCompletion: 20,
    accountStatus: 'active',
    deletionStatus: 'none',
    deletionRequestedAt: null,
    scheduledDeletionDate: null,
  };

  users.push(newRecord);
  saveStoredLocalUsers(users);

  // Set active session
  localStorage.setItem(ACTIVE_SESSION_KEY, userId);

  const profile = toUserProfile(newRecord);
  notifyAuthListeners();

  return { success: true, user: profile };
}

// Local Login
export async function loginLocalUser(
  username: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const trimmedUsername = username.trim().toLowerCase();

  if (!trimmedUsername || !password) {
    return { success: false, error: 'אנא הזן שם משתמש וסיסמה.' };
  }

  const users = getStoredLocalUsers();
  const user = users.find(
    (u) =>
      (u.username && u.username.toLowerCase() === trimmedUsername) ||
      (u.name && u.name.toLowerCase() === trimmedUsername)
  );

  if (!user) {
    return {
      success: false,
      error: 'פרטי ההתחברות אינם נכונים. אנא ודא ששם המשתמש והסיסמה נכונים.',
    };
  }

  // Verify password hash
  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.passwordHash) {
    return {
      success: false,
      error: 'פרטי ההתחברות אינם נכונים. אנא ודא ששם המשתמש והסיסמה נכונים.',
    };
  }

  if (user.accountStatus === 'deactivated') {
    return {
      success: false,
      error: 'חשבון זה הושבת במחשב זה. אנא פנה לתמיכה.',
    };
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveStoredLocalUsers(users);

  // Set active session
  localStorage.setItem(ACTIVE_SESSION_KEY, user.id);

  const profile = toUserProfile(user);
  notifyAuthListeners();

  return { success: true, user: profile };
}

// Local Logout
export function logoutLocalUser(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (e) {
    console.error('Error logging out locally:', e);
  }
  notifyAuthListeners();
}

// Update Local User Profile
export function updateLocalUserProfile(
  userId: string,
  updates: Partial<LocalUserRecord>
): UserProfile | null {
  const users = getStoredLocalUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  users[idx] = {
    ...users[idx],
    ...updates,
  };

  saveStoredLocalUsers(users);
  notifyAuthListeners();
  return toUserProfile(users[idx]);
}

// Request deletion (30 days grace)
export function requestLocalAccountDeletion(userId: string): void {
  const scheduled = new Date();
  scheduled.setDate(scheduled.getDate() + 30);
  updateLocalUserProfile(userId, {
    deletionStatus: 'pending_deletion',
    deletionRequestedAt: new Date().toISOString(),
    scheduledDeletionDate: scheduled.toISOString(),
  });
}

// Cancel deletion
export function cancelLocalAccountDeletion(userId: string): void {
  updateLocalUserProfile(userId, {
    deletionStatus: 'none',
    deletionRequestedAt: null,
    scheduledDeletionDate: null,
    accountStatus: 'active',
  });
}
