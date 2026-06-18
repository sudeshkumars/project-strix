'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')

module.exports = {
  name:     'webhookHealthCheck',
  interval: '0 6 * * *',   // 6am UTC daily

  async execute (client) {
    const webhooks = db.getAllWebhooks()
    if (!webhooks.length) return

    let alive   = 0
    let dead    = 0
    let errors  = 0

    for (const row of webhooks) {
      try {
        const res = await fetch(row.webhook_url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })

        if (res.status === 404) {
          // Webhook deleted — null it out so broadcasts skip this guild
          db.clearWebhook(row.guild_id)
          // Also update cache if loaded
          const cached = client.guildCache.get(row.guild_id)
          if (cached) {
            client.guildCache.set(row.guild_id, {
              ...cached,
              webhook_url: null,
              webhook_id:  null
            })
          }
          dead++
        } else if (res.ok || res.status === 405) {
          // 405 = Method Not Allowed, but webhook exists — that's fine
          alive++
        } else {
          errors++
        }
      } catch {
        // Network error — don't clear, may be transient
        errors++
      }
    }

    if (dead || errors) {
      logger.warn(`[webhookHealthCheck] ${alive} alive | ${dead} dead (cleared) | ${errors} errors`)
    } else {
      logger.info(`[webhookHealthCheck] All ${alive} webhook(s) healthy`)
    }
  }
}
