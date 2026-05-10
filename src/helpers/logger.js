'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const { redact } = require('./redact');

let _logger = null;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
}

function build(cfg) {
  if (_logger) return _logger;

  ensureDir(cfg.logging.dir);

  const baseFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      // Redact every meta payload before serialisation.
      const { level, message, timestamp, stack, ...meta } = info;
      const redacted = redact(meta);
      return { level, message, timestamp, stack, ...redacted };
    })(),
    winston.format.json(),
  );

  const transports = [
    new winston.transports.DailyRotateFile({
      filename: path.join(cfg.logging.dir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: cfg.logging.maxSize,
      maxFiles: `${cfg.logging.retentionDays}d`,
      zippedArchive: true,
      // Files are owner-read/write only.
      options: { mode: 0o600 },
    }),
    new winston.transports.DailyRotateFile({
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

function get() {
  if (!_logger) throw new Error('Logger not initialised. Call build(cfg) first.');
  return _logger;
}

module.exports = { build, get };
