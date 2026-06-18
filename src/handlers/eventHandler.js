'use strict'

const fs     = require('fs')
const path   = require('path')
const logger = require('../../shared/logger')

module.exports = function eventHandler (client) {
  const eventsDir = path.join(__dirname, '../events')

  function walk (dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.js')) continue

      let mod
      try { mod = require(full) } catch (e) {
        logger.error(`eventHandler: failed to load ${entry.name}: ${e.message}`)
        continue
      }

      if (!mod?.name || typeof mod.execute !== 'function') {
        logger.warn(`eventHandler: skipping ${entry.name} — missing name or execute`)
        continue
      }

      const fn = (...args) => mod.execute(client, ...args)
      mod.once ? client.once(mod.name, fn) : client.on(mod.name, fn)

      logger.debug(`EVENT loaded: ${mod.name}${mod.once ? ' (once)' : ''}`)
    }
  }

  walk(eventsDir)
  logger.info(`Events loaded`)
}
