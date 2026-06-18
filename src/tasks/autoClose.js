'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { safeSend } = require('../../shared/utils')

module.exports = {
  name:     'autoClose',
  interval: '*/15 * * * *',   // every 15 minutes

  async execute (client) {
    const guilds = db.getAllGuilds()

    for (const guild of guilds) {
      const config = client.guildCache.get(guild.guild_id)
      if (!config?.ticket_auto_close) continue

      const hours   = typeof config.ticket_auto_close === 'number' ? config.ticket_auto_close : 24
      const stale   = db.getStaleTickets(guild.guild_id, hours)

      for (const ticket of stale) {
        const g = client.guilds.cache.get(guild.guild_id)
        if (!g) continue

        const channel = g.channels.cache.get(ticket.channel_id)
        if (!channel) {
          db.updateTicket(ticket.ticket_id, { status: 'closed', closed_at: Math.floor(Date.now() / 1000) })
          continue
        }

        await safeSend(channel, {
          content: `⏰ This ticket has been inactive for **${hours}h** and will be closed automatically.`
        })

        db.updateTicket(ticket.ticket_id, {
          status:    'closed',
          closed_at: Math.floor(Date.now() / 1000)
        })

        setTimeout(async () => {
          try { await channel.delete('Auto-closed: inactivity') } catch {}
        }, 10000)

        logger.task('autoClose', `ticket #${ticket.ticket_id} in ${guild.guild_id}`)
      }
    }
  }
}
