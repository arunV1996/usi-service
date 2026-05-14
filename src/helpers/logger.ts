import fs from 'fs';
import path from 'path';
import winston, { Logger } from 'winston';
import 'winston-daily-rotate-file';
import { redact } from './redact';
import type { AppConfig } from '../types';

let _logger: Logger | null = null;

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
}

export function build(cfg: AppConfig): Logger {
  if (_logger) return _logger;

  ensureDir(cfg.logging.dir);

  const baseFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      const { level, message, timestamp, stack, ...meta } = info as Record<string, unknown>;
      const redacted = redact(meta);
      return { level, message, timestamp, stack, ...(redacted as object) } as winston.Logform.TransformableInfo;
    })(),
    winston.format.json(),
  );

  const transports: winston.transport[] = [
    new (winston.transports as unknown as { DailyRotateFile: new (opts: object) => winston.transport }).DailyRotateFile({
      filename: path.join(cfg.logging.dir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: cfg.logging.maxSize,
      maxFiles: `${cfg.logging.retentionDays}d`,
      zippedArchive: true,
      options: { mode: 0o600 },
    }),
    new (winston.transports as unknown as { DailyRotateFile: new (opts: object) => winston.transport }).DailyRotateFile({
      level: 'error',
      filename: path.join(cfg.logging.dir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: cfg.logging.maxSize,
      maxFiles: `${cfg.logging.retentionDays}d`,
      zippedArchive: true,
      options: { mode: 0o600 },
    }),
  ];

  if (!cfg.isProd) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
    );
  }

  _logger = winston.createLogger({
    level: cfg.logLevel,
    defaultMeta: { service: cfg.appName, env: cfg.env },
    format: baseFormat,
    transports,
    exitOnError: false,
  });

  return _logger;
}

export function get(): Logger {
  if (!_logger) throw new Error('Logger not initialised. Call build(cfg) first.');
  return _logger;
}
