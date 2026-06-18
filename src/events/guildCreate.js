'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { info } = require('../../shared/embed')
const { safeSend } = require('../../shared/utils')

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute (client, guild) {
    logger.info(`[GUILD JOIN] ${guild.name} (${guild.id}) — ${guild.memberCount} members`)

    // Provision DB rows
    db.createGuild(guild.id, guild.ownerId)
    db.createGuildConfig(guild.id)

    // Seed cache
    const { parseConfig } = require('../../shared/cache')
    const config = db.getGuildConfig(guild.id)
    client.guildCache.set(guild.id, parseConfig(config))

    // Welcome embed in system channel
    const systemChannel = guild.systemChannel
    if (systemChannel) {
      const embed = info(
        'Thanks for adding Stryx!',
        [
          `**Get started:** run \`/setup\` to configure the bot.`,
          `**Help:** \`/help\` lists all commands.`,
          `**Support:** stryx.gg/support`
        ].join('\n')
      ).setFooter({ text: `Stryx • ${guild.name}` })

      await safeSend(systemChannel, { embeds: [embed] })
    }

    // DM bot owner
    try {
      const owner = await client.users.fetch(process.env.BOT_OWNER_ID)
      await safeSend(owner, {
        content: [
          `✅ **Joined:** ${guild.name} (\`${guild.id}\`)`,
          `👑 **Owner:** \`${guild.ownerId}\``,
          `👥 **Members:** ${guild.memberCount}`,
          `📅 **Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
        ].join('\n')
      })
    } catch {}
  }
}
