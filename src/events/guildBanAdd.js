'use strict'

const { EmbedBuilder, AuditLogEvent } = require('discord.js')
const { sendLog }      = require('../../shared/logRouter')
const { COLORS }       = require('../../shared/embed')
const db               = require('../../shared/db')
const { trackAction, ACTION_TYPES } = require('./antiNuke')
const logger           = require('../../shared/logger')

module.exports = {
  name: 'guildBanAdd',
  async execute (client, ban) {
    db.incrementActivityStat(ban.guild.id, 'leaves')

    const embed = new EmbedBuilder()
      .setColor(COLORS.error)
      .setTitle('\ud83d\udd28 Member Banned')
      .addFields(
        { name: 'User',   value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Reason', value: ban.reason ?? 'No reason',              inline: true }
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
      .setTimestamp()

    await sendLog(client, ban.guild.id, 'ban', { embeds: [embed] })

    // Anti-nuke: track mass bans
    try {
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1
      })
      const entry = auditLogs.entries.first()
      if (entry) {
        const diff = Date.now() - entry.createdTimestamp
        if (diff < 5000 && !entry.executor.bot) {
          trackAction(client, ban.guild.id, entry.executor.id, ACTION_TYPES.MASS_BAN)
        }
      }
    } catch (e) {
      logger.debug(`guildBanAdd antiNuke: ${e.message}`)
    }
  }
}
