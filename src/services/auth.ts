export interface GoogleUserProfile {
  id: string; // Google sub ID
  email: string;
  name: string;
  picture: string;
  givenName?: string;
}

export const GOOGLE_CLIENT_ID = '665216465674-abb4e1omq7jfdcl320h7h3r9ktgqolhn.apps.googleusercontent.com';

const STORAGE_KEYS = {
  USER_PROFILE: 'clg_google_user_v1',
};

declare global {
  interface Window {
    google?: any;
    handleGoogleCredentialResponse?: (response: any) => void;
  }
}

type AuthChangeCallback = (user: GoogleUserProfile | null) => void;
const listeners: Set<AuthChangeCallback> = new Set();

function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode Google JWT credential', err);
    return null;
  }
}

export const AuthService = {
  /**
   * Get current cached user profile from storage
   */
  getUser(): GoogleUserProfile | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * Save user profile
   */
  saveUser(user: GoogleUserProfile | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    }
    listeners.forEach((cb) => cb(user));
  },

  /**
   * Subscribe to authentication status changes
   */
  onAuthChange(callback: AuthChangeCallback): () => void {
    listeners.add(callback);
    // Fire immediately with current state
    callback(this.getUser());
    return () => listeners.delete(callback);
  },

  /**
   * Initialize Google Identity Services SDK and prompt One-Tap
   */
  initGoogleAuth(onUserChange?: AuthChangeCallback): void {
    if (onUserChange) {
      this.onAuthChange(onUserChange);
    }

    const checkAndInit = () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id) {
        return false;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            const payload = decodeJwtPayload(response.credential);
            if (payload && payload.sub) {
              const user: GoogleUserProfile = {
                id: payload.sub,
                email: payload.email || '',
                name: payload.name || payload.given_name || 'ClassGrid Student',
                picture: payload.picture || '',
                givenName: payload.given_name,
              };
              this.saveUser(user);
            }
          },
          auto_select: true,
          cancel_on_tap_outside: false,
        });

        // If user is not yet logged in, prompt One-Tap smoothly
        if (!this.getUser()) {
          // Render native sign-in button into navbar if present
          const btnContainer = document.getElementById('google-signin-btn-container');
          if (btnContainer) {
            this.renderGoogleButton(btnContainer);
          }

          setTimeout(() => {
            try {
              window.google?.accounts?.id?.prompt((notification: any) => {
                if (notification.isNotDisplayed()) {
                  console.info('One-Tap prompt not displayed:', notification.getNotDisplayedReason());
                } else if (notification.isSkippedMoment()) {
                  console.info('One-Tap prompt skipped:', notification.getSkippedReason());
                }
              });
            } catch (err) {
              console.warn('Google One-Tap prompt error', err);
            }
          }, 800);
        }

        return true;
      } catch (err) {
        console.error('Failed to initialize Google Accounts', err);
        return false;
      }
    };

    // If script is already loaded
    if (!checkAndInit()) {
      // Poll briefly for script load
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkAndInit() || attempts > 40) {
          clearInterval(interval);
        }
      }, 250);
    }
  },

  /**
   * Programmatically trigger One-Tap prompt or Google Sign-In
   */
  promptSignIn(): void {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('Google prompt error', err);
      }
    }
  },

  /**
   * Render native Google Sign-in button into an element
   */
  renderGoogleButton(element: HTMLElement, options?: any): void {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.renderButton(element, {
        type: 'standard',
        theme: 'filled_black',
        size: 'medium',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        ...options,
      });
    }
  },

  /**
   * Sign out current user
   */
  signOut(): void {
    const user = this.getUser();
    if (user?.email && typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.revoke(user.email, () => {
          console.info('Google token revoked');
        });
      } catch (e) {
        console.warn('Revoke warning', e);
      }
    }
    this.saveUser(null);
  },
};
