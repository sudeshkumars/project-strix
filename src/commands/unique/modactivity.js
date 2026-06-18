'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db           = require('../../../shared/db')
const { info }     = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('modactivity')
    .setDescription('View mod action statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('days').setDescription('Lookback days (default 30)').setMinValue(1).setMaxValue(90).setRequired(false))
    .addUserOption(o => o.setName('mod').setDescription('Filter by specific mod').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const days    = interaction.options.getInteger('days') ?? 30
    const modUser = interaction.options.getUser('mod')
    const guildId = interaction.guild.id
    const since   = Math.floor(Date.now() / 1000) - (days * 86400)

    if (modUser) {
      // Single mod breakdown
      const stats = db.getModStats(guildId, modUser.id, since)
      if (!stats.length) {
        return interaction.editReply({ content: `No mod actions from ${modUser.tag} in the last ${days} days.` })
      }

      const total = stats.reduce((a, b) => a + b.count, 0)
      const embed = info(`🔨 Mod Activity — ${modUser.tag}`, `Last **${days}** days`)
        .setThumbnail(modUser.displayAvatarURL({ size: 64 }))
        .addFields(
          ...stats.map(s => ({ name: s.type.toUpperCase(), value: String(s.count), inline: true })),
          { name: 'Total', value: String(total), inline: true }
        )
      return interaction.editReply({ embeds: [embed] })
    }

    // All mods — aggregate from cases table
    const rows = db.getDb().prepare(`
      SELECT mod_id, type, COUNT(*) AS count
      FROM cases
      WHERE guild_id = ? AND created_at >= ?
      GROUP BY mod_id, type
      ORDER BY count DESC
    `).all(guildId, since)

    if (!rows.length) {
      return interaction.editReply({ content: `No mod actions in the last ${days} days.` })
    }

    // Group by mod
    const byMod = new Map()
    for (const row of rows) {
      if (!byMod.has(row.mod_id)) byMod.set(row.mod_id, { total: 0, actions: {} })
      const entry = byMod.get(row.mod_id)
      entry.total += row.count
      entry.actions[row.type] = (entry.actions[row.type] ?? 0) + row.count
    }

    const sorted = [...byMod.entries()].sort((a, b) => b[1].total - a[1].total)

    const embed = info(`🔨 Mod Activity — Last ${days} days`, null)
    for (const [modId, data] of sorted.slice(0, 10)) {
      const breakdown = Object.entries(data.actions)
        .map(([t, c]) => `${t}: ${c}`)
        .join(' | ')
      embed.addFields({
        name:  `<@${modId}> — ${data.total} actions`,
        value: breakdown || 'N/A',
        inline: false
      })
    }

    return interaction.editReply({ embeds: [embed] })
  }
}
