'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')

module.exports = {
  name:     'reminderTask',
  interval: '* * * * *',

  async execute (client) {
    const expired = db.getExpiredReminders()

    for (const reminder of expired) {
      db.markReminderFired(reminder.id)

      try {
        const message = `\u23f0 **Reminder:** ${reminder.content}`

        if (reminder.dm) {
          const user = await client.users.fetch(reminder.user_id).catch(() => null)
          if (user) {
            await user.send({ content: message }).catch(() => {})
          }
        } else {
          // Send in channel
          const guild   = client.guilds.cache.get(reminder.guild_id)
          if (!guild) continue
          const channel = guild.channels.cache.get(reminder.channel_id)
          if (channel) {
            await channel.send({ content: `<@${reminder.user_id}> ${message}` }).catch(() => {})
          }
        }
      } catch (e) {
        logger.debug(`reminderTask: failed for reminder ${reminder.id}: ${e.message}`)
      }
    }
  }
}
