export interface Actor {
  $id: string;
  email: string;
  name: string;
  emailVerification: boolean;
  isAdmin: boolean;
  labels?: string[];
  prefs?: Record<string, any>;
}

export interface AuthPort {
  /**
   * Retrieves the authenticated actor from the session context (cookies or explicit JWT).
   */
  getActor(jwt?: string): Promise<Actor | null>;

  /**
   * Generates a temporary JSON Web Token (JWT) for secure cross-origin or service-to-service validation.
   */
  createJWT(): Promise<{ jwt: string }>;

  /**
   * Checks whether the given email address is in the administrator list.
   */
  isEmailAdmin(email: string): boolean;
}
