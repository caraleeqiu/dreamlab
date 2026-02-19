/**
 * 轻量结构化日志工具
 * 统一替代散落各处的 console.error / console.log
 *
 * 输出格式（JSON 单行）方便生产环境日志收集（Datadog / CloudWatch / Logtail 等）:
 *   {"level":"error","ts":"2025-01-01T12:00:00.000Z","source":"webhook:kling","msg":"...","jobId":1}
 *
 * 开发环境额外输出带颜色的可读格式。
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

const IS_DEV = process.env.NODE_ENV !== 'production'

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info:  '\x1b[36m', // cyan
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

function log(level: LogLevel, source: string, msg: string, ctx?: LogContext) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    source,
    msg,
    ...ctx,
  }

  if (IS_DEV) {
    const color = LEVEL_COLORS[level]
    const prefix = `${color}[${level.toUpperCase()}]${RESET} ${entry.ts} [${source}]`
    const ctxStr = ctx ? ' ' + JSON.stringify(ctx) : ''
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${msg}${ctxStr}`)
  } else {
    // 生产环境：单行 JSON 方便日志平台解析
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry))
  }
}

/**
 * 创建带固定 source 前缀的 logger 实例
 * 用法：const logger = createLogger('webhook:kling')
 *       logger.info('clip done', { jobId: 1, clipIndex: 0 })
 */
export function createLogger(source: string) {
  return {
    debug: (msg: string, ctx?: LogContext) => log('debug', source, msg, ctx),
    info:  (msg: string, ctx?: LogContext) => log('info',  source, msg, ctx),
    warn:  (msg: string, ctx?: LogContext) => log('warn',  source, msg, ctx),
    error: (msg: string, ctx?: LogContext) => log('error', source, msg, ctx),
  }
}
