// src/utils/logger.ts
import winston from 'winston';
import { join } from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(options: {
    level?: string;
    filename?: string;
    console?: boolean;
  } = {}) {
    const { level = 'info', filename = 'geenius.log', console = true } = options;

    const transports: winston.transport[] = [];

    // File transport
    if (filename) {
      transports.push(
        new winston.transports.File({
          filename: join(process.cwd(), 'logs', filename),
          level: 'debug',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );

      // Error log
      transports.push(
        new winston.transports.File({
          filename: join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        })
      );
    }

    // Console transport
    if (console) {
      transports.push(
        new winston.transports.Console({
          level,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      exceptionHandlers: [
        new winston.transports.File({ 
          filename: join(process.cwd(), 'logs', 'exceptions.log') 
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({ 
          filename: join(process.cwd(), 'logs', 'rejections.log') 
        })
      ]
    });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any) {
    this.logger.error(message, error);
  }

  logAgentActivity(agentId: string, action: string, details: any) {
    this.info(`Agent ${agentId}: ${action}`, { 
      agentId, 
      action, 
      details,
      timestamp: new Date().toISOString()
    });
  }

  logTaskStart(taskId: string, description: string, agent: string) {
    this.info(`Task started: ${description}`, {
      taskId,
      description,
      agent,
      event: 'task_start'
    });
  }

  logTaskComplete(taskId: string, success: boolean, duration: number) {
    this.info(`Task completed: ${success ? 'SUCCESS' : 'FAILED'}`, {
      taskId,
      success,
      duration,
      event: 'task_complete'
    });
  }

  logAPICall(provider: string, model: string, tokens: number, cost: number) {
    this.info(`API call: ${provider}/${model}`, {
      provider,
      model,
      tokens,
      cost,
      event: 'api_call'
    });
  }

  logError(error: Error, context?: any) {
    this.error(error.message, {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context
    });
  }

  child(meta: any): Logger {
    const childLogger = this.logger.child(meta);
    return new Logger({});
  }
}

// Create default logger instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  console: process.env.NODE_ENV !== 'test'
});

