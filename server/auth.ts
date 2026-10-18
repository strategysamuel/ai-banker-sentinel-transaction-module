import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import firebaseConfig from '../firebase-applet-config.json';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

/**
 * Accepts Firebase Authentication ID tokens only.
 * Signature, issuer, audience, algorithm and expiry are verified before identity is trusted.
 */
export async function authenticateFirebaseToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Expected Authorization: Bearer <Firebase_ID_Token>.',
      code: 'AUTH_HEADER_MISSING',
    });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized: Empty token provided.', code: 'AUTH_TOKEN_EMPTY' });
    return;
  }

  try {
    const header = decodeProtectedHeader(idToken);
    if (header.alg !== 'RS256') {
      res.status(401).json({ error: 'Unauthorized: Unsupported token algorithm.', code: 'AUTH_TOKEN_INVALID' });
      return;
    }

    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = (payload.user_id || payload.sub) as string | undefined;
    if (!uid || typeof uid !== 'string') {
      res.status(401).json({ error: 'Unauthorized: Token has no valid user identity.', code: 'AUTH_UID_NOT_FOUND' });
      return;
    }

    req.user = { uid, email: typeof payload.email === 'string' ? payload.email : undefined };
    next();
  } catch (error) {
    // Never accept decoded-but-unverified JWTs, even in development.
    console.error('Firebase ID token verification failed:', error instanceof Error ? error.message : 'unknown error');
    res.status(401).json({
      error: 'Unauthorized: Invalid, expired, or incorrectly scoped Firebase ID token.',
      code: 'AUTH_TOKEN_INVALID',
    });
  }
}
