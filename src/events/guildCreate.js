'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { infoCard } = require('../../shared/components')
const { safeSend } = require('../../shared/utils')

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute (client, guild) {
    logger.info(`[GUILD JOIN] ${guild.name} (${guild.id}) \u2014 ${guild.memberCount} members`)

    // Provision DB rows
    db.createGuild(guild.id, guild.ownerId)
    db.createGuildConfig(guild.id)

    // Seed cache
    const { parseConfig } = require('../../shared/cache')
    const config = db.getGuildConfig(guild.id)
    client.guildCache.set(guild.id, parseConfig(config))

    // Welcome message in system channel
    const systemChannel = guild.systemChannel
    if (systemChannel) {
      await safeSend(systemChannel, infoCard(
        'Thanks for adding Stryx!',
        [
          '**Get started:** run `/setup` to configure the bot.',
          '**Help:** `/help` lists all commands.',
          '**Support:** stryx.gg/support'
        ],
        { subtext: `Stryx \u2022 ${guild.name}` }
      ))
    }

    // DM bot owner
    try {
      const owner = await client.users.fetch(process.env.BOT_OWNER_ID)
      await safeSend(owner, {
        content: [
          `\u2705 **Joined:** ${guild.name} (\`${guild.id}\`)`,
          `\u{1f451} **Owner:** \`${guild.ownerId}\``,
          `\u{1f465} **Members:** ${guild.memberCount}`,
          `\u{1f4c5} **Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
        ].join('\n')
      })
    } catch {}
  }
}
