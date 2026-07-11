import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'skb_poss_secret_key_12345';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    fullName: string;
    shopId: string;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // "Bearer <TOKEN>"

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token yaroqsiz yoki muddati o\'tgan' });
      }

      req.user = user as { id: string; username: string; role: string; fullName: string; shopId: string };
      next();
    });
  } else {
    res.status(401).json({ error: 'Avtorizatsiya tokeni topilmadi' });
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun huquqingiz yetarli emas' });
    }
    next();
  };
}
