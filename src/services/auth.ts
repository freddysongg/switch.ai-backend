import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';

import { AuthError, DatabaseError, ValidationError } from '../db/errors.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { JwtPayload, NewUserWithHashedPassword, User } from '../types/user.js';

const JWT_SECRET_KEY: Secret = process.env.JWT_SECRET as Secret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const SALT_ROUNDS = 10;

if (!JWT_SECRET_KEY) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

export class AuthService {
  public async registerUser(payload: {
    email: string;
    password?: string;
    name?: string | null;
    role?: string;
  }): Promise<Omit<User, 'hashedPassword'>> {
    const { email, password, name, role } = payload;
    if (!email || !password) {
      throw new ValidationError('Email and password are required for registration.');
    }
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser) {
      throw new ValidationError('User with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const userData: NewUserWithHashedPassword = {
        email,
        hashedPassword,
        name: name || null,
        role: role || 'user'
      };
      const [newUserRecord] = await db.insert(users).values(userData).returning();

      if (!newUserRecord) {
        throw new DatabaseError('Failed to create user after registration.');
      }
      const { hashedPassword: _, ...userWithoutPassword } = newUserRecord;
      return userWithoutPassword;
    } catch (error: any) {
      console.error('Error during user registration in service:', error);
      if (error.code === '23505') {
        throw new ValidationError('User with this email already exists.');
      }
      throw new DatabaseError('User registration failed.', error);
    }
  }

  public async loginUser(
    email: string,
    passwordPlainText: string
  ): Promise<{ token: string; user: Omit<User, 'hashedPassword' | 'createdAt' | 'updatedAt'> }> {
    if (!email || !passwordPlainText) {
      throw new ValidationError('Email and password are required for login.');
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        hashedPassword: users.hashedPassword,
        role: users.role
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.hashedPassword) {
      throw new AuthError('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(passwordPlainText, user.hashedPassword);
    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password.');
    }

    const userForToken: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    const token = this.generateToken(userForToken);

    const { hashedPassword: _h, ...userToReturn } = user;

    return { token, user: userToReturn };
  }

  public generateToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as any
    };
    const tokenPayload = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name
    };
    return jwt.sign(tokenPayload, JWT_SECRET_KEY, options);
  }

  public verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET_KEY) as JwtPayload;
      return decoded;
    } catch (error) {
      console.warn('JWT verification failed:', error);
      return null;
    }
  }
}
