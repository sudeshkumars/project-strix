'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db           = require('../../../shared/db')
const { infoCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('serverhealth')
    .setDescription('View a server health dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute (client, interaction) {
    await interaction.deferReply()

    const guild   = interaction.guild
    const guildId = guild.id

    await guild.fetch()

    const stats7  = db.getActivityStats(guildId, 7)
    const stats30 = db.getActivityStats(guildId, 30)

    const msg7   = stats7.reduce((a, b)  => a + (b.messages ?? 0), 0)
    const msg30  = stats30.reduce((a, b) => a + (b.messages ?? 0), 0)
    const join7  = stats7.reduce((a, b)  => a + (b.joins ?? 0), 0)
    const leave7 = stats7.reduce((a, b)  => a + (b.leaves ?? 0), 0)
    const voice7 = stats7.reduce((a, b)  => a + (b.voice_minutes ?? 0), 0)

    const retention = join7 > 0 ? ((join7 - leave7) / join7 * 100).toFixed(1) : 'N/A'

    const ticketStats = db.getTicketStats(guildId)

    const activeWarns = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM warnings
      WHERE guild_id = ? AND pardoned = 0 AND created_at >= ?
    `).get(guildId, Math.floor(Date.now() / 1000) - 30 * 86400).count

    const activeBans = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM cases
      WHERE guild_id = ? AND type IN ('ban','tempban') AND active = 1
    `).get(guildId).count

    const automodFires = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM cases
      WHERE guild_id = ? AND mod_id = ? AND created_at >= ?
    `).get(guildId, client.user.id, Math.floor(Date.now() / 1000) - 7 * 86400).count

    const healthScore = calcHealthScore({ join7, leave7, msg7, activeBans, activeWarns })

    const lines = [
      `\u{1f4ca} **Health Score** \u2014 ${healthScore}/100`,
      `\u{1f465} **Members** \u2014 ${guild.memberCount}`,
      `\u{1f4e5} **7d Net Growth** \u2014 ${join7 - leave7 >= 0 ? '+' : ''}${join7 - leave7}`,
      `\u{1f4ac} **7d Messages** \u2014 ${msg7}`,
      `\u{1f4ac} **30d Messages** \u2014 ${msg30}`,
      `\u{1f399}\ufe0f **7d Voice min** \u2014 ${voice7}`,
      `\u{1f4e5} **7d Joins** \u2014 ${join7}`,
      `\u{1f4e4} **7d Leaves** \u2014 ${leave7}`,
      `\u{1f4c8} **Retention** \u2014 ${retention !== 'N/A' ? `${retention}%` : 'N/A'}`,
      `\u{1f3ab} **Open Tickets** \u2014 ${ticketStats.open ?? 0}`,
      `\u26a0\ufe0f **Active Warns** \u2014 ${activeWarns}`,
      `\u{1f528} **Active Bans** \u2014 ${activeBans}`,
      `\u{1f6e1}\ufe0f **Automod 7d** \u2014 ${automodFires}`
    ]

    await interaction.editReply(infoCard(`\u{1f3e5} Server Health \u2014 ${guild.name}`, lines, {
      thumbnail: guild.iconURL() || undefined
    }))
  }
}

function calcHealthScore ({ join7, leave7, msg7, activeBans, activeWarns }) {
  let score = 60
  if (join7 > leave7)   score += 15
  if (msg7 > 50)        score += 10
  if (msg7 > 200)       score += 5
  if (activeBans < 5)   score += 5
  if (activeWarns < 10) score += 5
  return Math.min(100, Math.max(0, score))
}
