import { AuthUser, SessionRole } from '@webinar/shared';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

export interface SessionState {
  id?: string;
  title?: string;
  slug?: string;
  status?: string;
  instructorName?: string;
}

export interface RoomState {
  roomId: string | null;
  liveKitToken: string | null;
  signalToken: string | null;
  participantName: string;
  role: SessionRole | 'attendee' | 'organizer';
  isHost: boolean;
}

export interface GlobalStoreState {
  auth: AuthState;
  session: SessionState;
  room: RoomState;
}

type Listener = () => void;

class GlobalStore {
  private state: GlobalStoreState = {
    auth: {
      user: null,
      token: null,
    },
    session: {},
    room: {
      roomId: null,
      liveKitToken: null,
      signalToken: null,
      participantName: '',
      role: 'attendee',
      isHost: false,
    },
  };

  private listeners = new Set<Listener>();

  constructor() {
    // Hydrate auth from sessionStorage/localStorage if available
    try {
      const storedAuth = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
      const storedUser = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
      if (storedAuth) {
        this.state.auth.token = storedAuth;
      }
      if (storedUser) {
        this.state.auth.user = JSON.parse(storedUser);
      }
    } catch {
      // Ignore parse failure
    }
  }

  getState(): GlobalStoreState {
    return this.state;
  }

  setAuth(auth: Partial<AuthState>) {
    this.state.auth = { ...this.state.auth, ...auth };
    this.notify();
  }

  setSession(session: Partial<SessionState>) {
    this.state.session = { ...this.state.session, ...session };
    this.notify();
  }

  setRoom(room: Partial<RoomState>) {
    this.state.room = { ...this.state.room, ...room };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const store = new GlobalStore();
