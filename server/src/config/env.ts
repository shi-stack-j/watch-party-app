import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/watchparty_db',
  SESSION_SECRET: process.env.SESSION_SECRET || 'super_secret_watch_party_session_key',
};

export const isProduction = env.NODE_ENV === 'production';
