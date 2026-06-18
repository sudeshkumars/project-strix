'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { safeSend } = require('../../shared/utils')

module.exports = {
  name: 'guildDelete',
  once: false,
  async execute (client, guild) {
    logger.guildEvent('leave', guild.id, guild.name ?? guild.id, guild.memberCount ?? 0)

    // Wipe all guild data
    db.deleteGuildData(guild.id)
    client.guildCache.delete(guild.id)

    // DM bot owner
    try {
      const owner = await client.users.fetch(process.env.BOT_OWNER_ID)
      await safeSend(owner, {
        content: [
          `❌ **Left:** ${guild.name ?? 'Unknown'} (\`${guild.id}\`)`,
          `👥 **Had:** ${guild.memberCount ?? '?'} members`,
          `📅 **Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
        ].join('\n')
      })
    } catch {}
  }
}
