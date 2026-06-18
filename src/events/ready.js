'use strict'

const logger             = require('../../shared/logger')
const db                 = require('../../shared/db')
const { loadAllConfigs } = require('../../shared/cache')

module.exports = {
  name: 'ready',
  once: true,
  async execute (client) {
    logger.info(`Logged in as ${client.user.tag}`)
    client.user.setActivity('/help', { type: 3 }) // WATCHING

    // Load guild configs into cache
    loadAllConfigs(client)

    // Load invite cache for all guilds
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch()
        const cache = new Map()
        for (const [code, invite] of invites) {
          cache.set(code, invite.uses)
        }
        client.inviteCache.set(guildId, cache)
      } catch {
        // Guild may not grant invite permissions
      }
    }

    // Clean dead webhooks
    try {
      const webhooks = db.getAllWebhooks()
      for (const row of webhooks) {
        try {
          const res = await fetch(row.webhook_url, { method: 'HEAD' })
          if (res.status === 404) {
            db.clearWebhook(row.guild_id)
            logger.warn(`Cleared dead webhook for guild ${row.guild_id}`)
          }
        } catch {
          db.clearWebhook(row.guild_id)
          logger.warn(`Cleared dead webhook for guild ${row.guild_id}`)
        }
      }
    } catch (e) {
      logger.warn('Webhook validation skipped:', e.message)
    }

    logger.info(
      `Stryx ready — ${client.guilds.cache.size} guilds, ${client.commands.size} commands, user: ${client.user.tag}`
    )
  }
}
