import type { AppDb } from '../db/client';
import type { AppConfig } from '../lib/config';
import type { createAuth } from '../middleware/auth';
import type { GoogleGenAI } from '@google/genai';

export interface Deps {
  db: AppDb;
  config: AppConfig;
  auth: ReturnType<typeof createAuth>;
  ai: GoogleGenAI | null;
}
