'use strict'

const fs     = require('fs')
const path   = require('path')
const cron   = require('node-cron')
const logger = require('../../shared/logger')

module.exports = function taskHandler (client) {
  const tasksDir = path.join(__dirname, '../tasks')

  for (const file of fs.readdirSync(tasksDir).filter(f => f.endsWith('.js'))) {
    let mod
    try { mod = require(path.join(tasksDir, file)) } catch (e) {
      logger.error(`taskHandler: failed to load ${file}: ${e.message}`)
      continue
    }

    if (!mod?.interval || typeof mod.execute !== 'function') {
      logger.warn(`taskHandler: skipping ${file} — missing interval or execute`)
      continue
    }

    if (!cron.validate(mod.interval)) {
      logger.warn(`taskHandler: invalid cron "${mod.interval}" in ${file}`)
      continue
    }

    cron.schedule(mod.interval, async () => {
      try {
        await mod.execute(client)
      } catch (e) {
        logger.error(`taskHandler: error in ${file}: ${e.message}`)
      }
    })

    logger.debug(`TASK loaded: ${mod.name ?? file} (${mod.interval})`)
  }

  logger.info(`Tasks loaded`)
}
