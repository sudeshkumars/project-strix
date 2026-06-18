'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db           = require('../../../shared/db')
const { infoCard } = require('../../../shared/components')

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
      const stats = db.getModStats(guildId, modUser.id, since)
      if (!stats.length) {
        return interaction.editReply(infoCard(`\u{1f528} Mod Activity \u2014 ${modUser.tag}`, [`No mod actions in the last ${days} days.`]))
      }

      const total = stats.reduce((a, b) => a + b.count, 0)
      const lines = [
        `Last **${days}** days`,
        '',
        ...stats.map(s => `**${s.type.toUpperCase()}** \u2014 ${s.count}`),
        '',
        `**Total** \u2014 ${total}`
      ]
      return interaction.editReply(infoCard(`\u{1f528} Mod Activity \u2014 ${modUser.tag}`, lines, {
        thumbnail: modUser.displayAvatarURL({ size: 64 })
      }))
    }

    // All mods
    const rows = db.getDb().prepare(`
      SELECT mod_id, type, COUNT(*) AS count
      FROM cases
      WHERE guild_id = ? AND created_at >= ?
      GROUP BY mod_id, type
      ORDER BY count DESC
    `).all(guildId, since)

    if (!rows.length) {
      return interaction.editReply(infoCard(`\u{1f528} Mod Activity \u2014 Last ${days} days`, [`No mod actions in the last ${days} days.`]))
    }

    const byMod = new Map()
    for (const row of rows) {
      if (!byMod.has(row.mod_id)) byMod.set(row.mod_id, { total: 0, actions: {} })
      const entry = byMod.get(row.mod_id)
      entry.total += row.count
      entry.actions[row.type] = (entry.actions[row.type] ?? 0) + row.count
    }

    const sorted = [...byMod.entries()].sort((a, b) => b[1].total - a[1].total)

    const lines = sorted.slice(0, 10).map(([modId, data]) => {
      const breakdown = Object.entries(data.actions)
        .map(([t, c]) => `${t}: ${c}`)
        .join(' | ')
      return `<@${modId}> \u2014 **${data.total}** actions\n> ${breakdown || 'N/A'}`
    })

    return interaction.editReply(infoCard(`\u{1f528} Mod Activity \u2014 Last ${days} days`, lines))
  }
}
