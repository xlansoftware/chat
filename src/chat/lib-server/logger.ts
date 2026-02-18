type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function log(level: LogLevel, message: string, meta?: unknown) {
  if (levelOrder[level] < levelOrder[LOG_LEVEL]) return;

  const prefix = `[${level}]`;
  if (meta) {
    console[level](prefix, message, meta);
  } else {
    console[level](prefix, message);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};
