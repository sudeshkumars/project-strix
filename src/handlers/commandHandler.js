'use strict'

const fs     = require('fs')
const path   = require('path')
const logger = require('../../shared/logger')

module.exports = function commandHandler (client) {
  const cmdsDir = path.join(__dirname, '../commands')

  function walk (dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.js')) continue

      let mod
      try { mod = require(full) } catch (e) {
        logger.error(`commandHandler: failed to load ${entry.name}: ${e.message}`)
        continue
      }

      if (!mod?.data?.name || typeof mod.execute !== 'function') {
        logger.warn(`commandHandler: skipping ${entry.name} — missing data.name or execute`)
        continue
      }

      const name = mod.data.name
      client.commands.set(name, mod)

      if (Array.isArray(mod.aliases)) {
        for (const alias of mod.aliases) client.aliases.set(alias, name)
      }

      logger.debug(`CMD loaded: ${name}`)
    }
  }

  walk(cmdsDir)
  logger.info(`Commands loaded: ${client.commands.size}`)
}
