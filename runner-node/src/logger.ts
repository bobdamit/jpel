import pino from 'pino';

// Configure logger level via environment variable; default to 'info'
const level = process.env.LOG_LEVEL || 'info';

const pinoLogger = pino({
  level,
  base: { pid: false },
  timestamp: pino.stdTimeFunctions.isoTime
});

// Thin wrapper to keep the existing API
export const logger = {
  info: (msg: string, data?: any) => pinoLogger.info(data || {}, msg),
  warn: (msg: string, data?: any) => pinoLogger.warn(data || {}, msg),
  error: (msg: string, data?: any) => pinoLogger.error(data || {}, msg),
  debug: (msg: string, data?: any) => pinoLogger.debug(data || {}, msg),
};

export default logger;
