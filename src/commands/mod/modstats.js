'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db             = require('../../../shared/db')
const { modCard }    = require('../../../shared/components')
const { capitalise } = require('../../../shared/utils')

const TIMEFRAMES = {
  '24h':  86400,
  '7d':   604800,
  '30d':  2592000,
  'all':  0
}

const ACTION_EMOJI = {
  warn:    '\u26a0\ufe0f',
  mute:    '\u{1f507}',
  kick:    '\u{1f462}',
  ban:     '\u{1f528}',
  tempban: '\u23f3',
  softban: '\u{1f9f9}',
  unban:   '\u2705',
  unmute:  '\u{1f50a}',
  note:    '\u{1f4dd}'
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

    const targetMod    = interaction.options.getUser('mod') ?? interaction.user
    const timeframeKey = interaction.options.getString('timeframe') ?? '30d'
    const guild        = interaction.guild

    const windowSecs = TIMEFRAMES[timeframeKey] ?? TIMEFRAMES['30d']
    const since      = windowSecs > 0
      ? Math.floor(Date.now() / 1000) - windowSecs
      : 0

    const rows = db.getModStats(guild.id, targetMod.id, since)

    if (!rows.length) {
      return interaction.editReply(modCard(`\u{1f4ca} Mod Stats \u2014 ${targetMod.tag}`, [
        'No moderation actions found in this timeframe.'
      ], {
        thumbnail: targetMod.displayAvatarURL({ size: 64 }),
        subtext: `Timeframe: ${timeframeKey === 'all' ? 'All time' : `Last ${timeframeKey}`}`
      }))
    }

    let total = 0
    const lines = []

    for (const row of rows) {
      const emoji = ACTION_EMOJI[row.type] ?? '\u{1f539}'
      lines.push(`${emoji} **${capitalise(row.type)}** \u2014 ${row.count}`)
      total += row.count
    }

    lines.push('')
    lines.push(`**Total Actions** \u2014 ${total}`)

    await interaction.editReply(modCard(`\u{1f4ca} Mod Stats \u2014 ${targetMod.tag}`, lines, {
      thumbnail: targetMod.displayAvatarURL({ size: 64 }),
      subtext: `Timeframe: ${timeframeKey === 'all' ? 'All time' : `Last ${timeframeKey}`}`
    }))
  }
}
