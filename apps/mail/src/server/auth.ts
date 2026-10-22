import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { CONFIG } from "./config";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, CONFIG.JWT_SECRET, { expiresIn: "30d" });
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function comparePassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin" && req.user?.email !== "admin@logixsoft.in") {
      res.status(403).json({ error: "Admin privilege required" });
      return;
    }
    next();
  });
}
