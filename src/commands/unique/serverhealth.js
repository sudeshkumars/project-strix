'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db           = require('../../../shared/db')
const { info }     = require('../../../shared/embed')

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

    // Open tickets
    const ticketStats = db.getTicketStats(guildId)

    // Active warns
    const activeWarns = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM warnings
      WHERE guild_id = ? AND pardoned = 0 AND created_at >= ?
    `).get(guildId, Math.floor(Date.now() / 1000) - 30 * 86400).count

    // Active bans
    const activeBans = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM cases
      WHERE guild_id = ? AND type IN ('ban','tempban') AND active = 1
    `).get(guildId).count

    // Automod fires (last 7d)
    const automodFires = db.getDb().prepare(`
      SELECT COUNT(*) AS count FROM cases
      WHERE guild_id = ? AND mod_id = ? AND created_at >= ?
    `).get(guildId, client.user.id, Math.floor(Date.now() / 1000) - 7 * 86400).count

    const healthScore = calcHealthScore({ join7, leave7, msg7, activeBans, activeWarns })

    const embed = info(`🏥 Server Health — ${guild.name}`, null)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '📊 Health Score', value: `${healthScore}/100`, inline: true },
        { name: '👥 Members',      value: String(guild.memberCount), inline: true },
        { name: '📥 7d Net Growth', value: `${join7 - leave7 >= 0 ? '+' : ''}${join7 - leave7}`, inline: true },
        { name: '💬 7d Messages',  value: String(msg7),   inline: true },
        { name: '💬 30d Messages', value: String(msg30),  inline: true },
        { name: '🎙️ 7d Voice min', value: String(voice7), inline: true },
        { name: '📥 7d Joins',     value: String(join7),  inline: true },
        { name: '📤 7d Leaves',    value: String(leave7), inline: true },
        { name: '📈 Retention',    value: retention !== 'N/A' ? `${retention}%` : 'N/A', inline: true },
        { name: '🎫 Open Tickets', value: String(ticketStats.open ?? 0),   inline: true },
        { name: '⚠️ Active Warns', value: String(activeWarns),             inline: true },
        { name: '🔨 Active Bans',  value: String(activeBans),              inline: true },
        { name: '🛡️ Automod 7d',  value: String(automodFires),            inline: true }
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
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
