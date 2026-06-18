'use strict'

// Full implementation in Part 3
const logger = {
  info:    (...a) => console.log('[INFO]', ...a),
  warn:    (...a) => console.warn('[WARN]', ...a),
  error:   (...a) => console.error('[ERROR]', ...a),
  debug:   (...a) => process.env.NODE_ENV !== 'production' && console.log('[DEBUG]', ...a),
  command: (name, userId, guildId) => console.log(`[CMD] /${name} by ${userId}${guildId ? ` in ${guildId}` : ''}`)
}

module.exports = logger