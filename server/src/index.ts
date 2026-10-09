import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { env, isProduction } from './config/env';
import { logger } from './utils/logger';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { initSocket } from './socket';
import { prisma } from './config/prisma';

export const app = express();
export const server = http.createServer(app);

// Trust proxy for secure cookies behind reverse proxies (Render, Railway, Heroku, Nginx)
if (isProduction) {
  app.set('trust proxy', 1);
}

// CORS configuration (supports single-origin and specified allowed origins)
const allowedOrigins = env.CLIENT_URL
  ? env.CLIENT_URL.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, same-origin static frontend) or listed origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parse DATABASE_URL into host, port, user, password, database for MySQLStore
const parseDbUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    const sslParam = url.searchParams.get('ssl') || url.searchParams.get('sslmode');
    const hasSsl = sslParam === 'true' || sslParam === 'require' || process.env.MYSQL_SSL === 'true';
    return {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 3306,
      user: decodeURIComponent(url.username || 'root'),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, '') || 'watchparty_db',
      ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
    };
  } catch {
    return {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'watchparty_db',
      ssl: undefined,
    };
  }
};

const dbConfig = parseDbUrl(env.DATABASE_URL);
const MySQLStore = MySQLStoreFactory(session as unknown as typeof session);
export const sessionStore = new MySQLStore({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  ...(dbConfig.ssl ? { ssl: dbConfig.ssl } : {}),
  createDatabaseTable: true,
  schema: {
    tableName: 'Session',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data',
    },
  },
} as any);

app.use(
  session({
    name: 'watchparty_sid',
    secret: env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Single-Origin Production Static File Serving & React Router Client-Side Fallback
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  logger.info(`Serving static client files from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // 404 Handler when running in standalone API mode
  app.use(notFoundHandler);
}

// Global Error Handler
app.use(errorHandler);

// Initialize Socket.IO with Session Store reference
export const io = initSocket(server, sessionStore);

// Start server and handle graceful shutdown if main entry
if (process.env.NODE_ENV !== 'test') {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down server gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await prisma.$disconnect();
        logger.info('Database connection closed.');
      } catch (e) {
        logger.error('Error disconnecting database:', e);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${env.PORT} [env: ${env.NODE_ENV}]`);
    logger.info(`Allowed CORS origin: ${env.CLIENT_URL}`);
  });
}

