'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db             = require('../../../shared/db')
const { COLORS }     = require('../../../shared/embed')
const { parseDuration, capitalise } = require('../../../shared/utils')

// Timeframe options
const TIMEFRAMES = {
  '24h':  86400,
  '7d':   604800,
  '30d':  2592000,
  'all':  0
}

const ACTION_EMOJI = {
  warn:    '⚠️',
  mute:    '🔇',
  kick:    '👢',
  ban:     '🔨',
  tempban: '⏳',
  softban: '🧹',
  unban:   '✅',
  unmute:  '🔊',
  note:    '📝'
}

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('View moderation action statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName('mod')
        .setDescription('Moderator to view stats for (defaults to yourself)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('timeframe')
        .setDescription('Time period (default: 30d)')
        .addChoices(
          { name: 'Last 24 hours', value: '24h' },
          { name: 'Last 7 days',   value: '7d'  },
          { name: 'Last 30 days',  value: '30d' },
          { name: 'All time',      value: 'all' }
        )
        .setRequired(false)
    ),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const targetMod  = interaction.options.getUser('mod') ?? interaction.user
    const timeframeKey = interaction.options.getString('timeframe') ?? '30d'
    const guild      = interaction.guild

    const windowSecs = TIMEFRAMES[timeframeKey] ?? TIMEFRAMES['30d']
    const since      = windowSecs > 0
      ? Math.floor(Date.now() / 1000) - windowSecs
      : 0

    const rows = db.getModStats(guild.id, targetMod.id, since)

    const embed = new EmbedBuilder()
      .setColor(COLORS.mod)
      .setTitle(`📊 Mod Stats — ${targetMod.tag}`)
      .setThumbnail(targetMod.displayAvatarURL({ size: 64 }))
      .setFooter({ text: `Timeframe: ${timeframeKey === 'all' ? 'All time' : `Last ${timeframeKey}`}` })
      .setTimestamp()

    if (!rows.length) {
      embed.setDescription('No moderation actions found in this timeframe.')
      return interaction.editReply({ embeds: [embed] })
    }

    let total = 0
    const lines = []

    for (const row of rows) {
      const emoji = ACTION_EMOJI[row.type] ?? '🔹'
      lines.push(`${emoji} **${capitalise(row.type)}**: ${row.count}`)
      total += row.count
    }

    embed
      .setDescription(lines.join('\n'))
      .addFields({ name: 'Total Actions', value: String(total), inline: true })

    await interaction.editReply({ embeds: [embed] })
  }
}
