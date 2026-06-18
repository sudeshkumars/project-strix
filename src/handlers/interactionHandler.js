'use strict'

const fs     = require('fs')
const path   = require('path')
const logger = require('../../shared/logger')

module.exports = function interactionHandler (client) {
  const dirs = {
    buttons: path.join(__dirname, '../interactions/buttons'),
    modals:  path.join(__dirname, '../interactions/modals'),
    menus:   path.join(__dirname, '../interactions/menus')
  }

  for (const [type, dir] of Object.entries(dirs)) {
    if (!fs.existsSync(dir)) continue

    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      let mod
      try { mod = require(path.join(dir, file)) } catch (e) {
        logger.error(`interactionHandler: failed to load ${file}: ${e.message}`)
        continue
      }

      // Support array exports — multiple handlers per file
      const handlers = Array.isArray(mod) ? mod : [mod]

      for (const handler of handlers) {
        // Support both .customId and legacy .id field
        const id = handler?.customId ?? handler?.id
        if (!id || typeof handler.execute !== 'function') {
          logger.warn(`interactionHandler: skipping entry in ${file} — missing customId or execute`)
          continue
        }

        const map = type === 'buttons' ? client.buttons
                  : type === 'modals'  ? client.modals
                  : client.menus

        map.set(id, handler)
        logger.debug(`${type.slice(0, -1).toUpperCase()} loaded: ${id instanceof RegExp ? id.source : id}`)
      }
    }
  }

  logger.info(`Interactions loaded — buttons:${client.buttons.size} modals:${client.modals.size} menus:${client.menus.size}`)
}
