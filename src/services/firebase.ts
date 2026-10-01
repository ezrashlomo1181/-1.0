import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  getDocFromServer,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../types/financial';

const app = initializeApp(firebaseConfig);

// Critical: pass firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const appleProvider = new OAuthProvider('apple.com');

// Test connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: client is offline or database initializing.');
    }
  }
}
testFirestoreConnection();

// Error handler conforming to guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// User Profile Firestore operations
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
}

export async function createOrUpdateUserProfile(
  user: FirebaseUser,
  customName?: string,
  providerOverride?: 'google.com' | 'apple.com' | 'password'
): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getUserProfile(user.uid);
  const now = new Date().toISOString();

  const provider =
    providerOverride ||
    (user.providerData[0]?.providerId as any) ||
    'password';

  const isAdminEmail = user.email?.toLowerCase() === 'ezrashlomow@gmail.com';

  if (!existing) {
    const newProfile: UserProfile = {
      id: user.uid,
      name: customName || user.displayName || user.email?.split('@')[0] || 'משתמש',
      email: user.email || '',
      authProvider: provider,
      createdAt: now,
      lastLogin: now,
      role: isAdminEmail ? 'admin' : 'user',
      accountStatus: 'active',
      deletionStatus: 'none',
      deletionRequestedAt: null,
      scheduledDeletionDate: null,
      financialProfileCompletion: 0,
      onboardingCompleted: false,
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  } else {
    const updated = {
      lastLogin: now,
      name: customName || existing.name,
      role: isAdminEmail ? ('admin' as const) : existing.role,
    };
    await updateDoc(userRef, updated);
    return { ...existing, ...updated };
  }
}

export async function updateUserProfileDoc(uid: string, fields: Partial<UserProfile>): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), fields);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// Admin: fetch all users (ONLY metadata, NO financial access)
export async function getAllUsersForAdmin(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

// Account Deletion Grace Period: Request deletion (30 days)
export async function requestAccountDeletion(uid: string): Promise<void> {
  const now = new Date();
  const scheduledDate = new Date();
  scheduledDate.setDate(now.getDate() + 30);

  await updateUserProfileDoc(uid, {
    deletionStatus: 'pending_deletion',
    deletionRequestedAt: now.toISOString(),
    scheduledDeletionDate: scheduledDate.toISOString(),
  });
}

// Cancel Account Deletion
export async function cancelAccountDeletion(uid: string): Promise<void> {
  await updateUserProfileDoc(uid, {
    deletionStatus: 'none',
    deletionRequestedAt: null,
    scheduledDeletionDate: null,
    accountStatus: 'active',
  });
}
