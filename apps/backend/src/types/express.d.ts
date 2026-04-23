// Augment Express Request with auth context populated by the authenticate middleware.
// userId and sessionId are always strings (stringified ObjectIds) at the handler level.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
      apiKeyId?: string;
      apiKeyScopes?: string[];
      authType?: 'jwt' | 'api_key';
    }
  }
}

export { };
