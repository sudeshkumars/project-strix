'use strict'

const logger = require('../../shared/logger')

module.exports = {
  name: 'ready',
  once: true,
  execute (client) {
    logger.info(`Logged in as ${client.user.tag}`)
    client.user.setActivity('/help', { type: 3 }) // WATCHING
  }
}
