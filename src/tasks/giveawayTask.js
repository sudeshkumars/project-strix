'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { endGiveaway } = require('../commands/community/giveaway')

module.exports = {
  name:     'giveawayTask',
  interval: '* * * * *',  // every minute

  async execute (client) {
    const now      = Math.floor(Date.now() / 1000)
    const active   = db.getActiveGiveaways()
    const expired  = active.filter(g => g.ends_at <= now)

    for (const gw of expired) {
      try {
        await endGiveaway(client, gw)
        logger.task('giveawayTask', `ended giveaway #${gw.id} in ${gw.guild_id}`)
      } catch (e) {
        logger.error(`giveawayTask: failed to end #${gw.id}: ${e.message}`)
      }
    }
  }
}
