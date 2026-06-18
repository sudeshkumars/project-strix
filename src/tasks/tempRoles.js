'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')

module.exports = {
  name:     'tempRoles',
  interval: '* * * * *',   // every minute

  async execute (client) {
    const expired = db.getExpiredTempRoles()

    for (const entry of expired) {
      db.deactivateTempRole(entry.id)

      const guild = client.guilds.cache.get(entry.guild_id)
      if (!guild) continue

      let member
      try { member = await guild.members.fetch(entry.user_id) } catch { continue }

      try {
        await member.roles.remove(entry.role_id, '[Stryx] Temp role expired')
        logger.task('tempRoles', `removed <@&${entry.role_id}> from ${entry.user_id} in ${entry.guild_id}`)
      } catch (e) {
        logger.debug(`tempRoles: could not remove role ${entry.role_id}: ${e.message}`)
      }
    }
  }
}
