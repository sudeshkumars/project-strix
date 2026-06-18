'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')

module.exports = {
  name:     'tempUnpunish',
  interval: '* * * * *',   // every minute

  async execute (client) {
    const expired = db.getExpiredTempPunishments()

    for (const entry of expired) {
      db.deactivateTempPunishment(entry.id)

      const guild = client.guilds.cache.get(entry.guild_id)
      if (!guild) continue

      try {
        if (entry.type === 'ban') {
          await guild.members.unban(entry.user_id, '[Stryx] Temp-ban expired')
          logger.task('tempUnpunish', `unbanned ${entry.user_id} in ${entry.guild_id}`)
        }
        // Mute (timeout) expires automatically via Discord — no action needed
      } catch (e) {
        logger.debug(`tempUnpunish: could not lift ${entry.type} for ${entry.user_id}: ${e.message}`)
      }

      if (entry.case_id) db.deactivateCase(entry.case_id, entry.guild_id)
    }
  }
}
