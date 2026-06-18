'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db             = require('../../../shared/db')
const { infoCard }   = require('../../../shared/components')
const { calcLevel }  = require('../../../shared/utils')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server XP leaderboard')
    .addStringOption(o => o.setName('type').setDescription('Leaderboard type').setRequired(false)
      .addChoices(
        { name: 'XP',   value: 'xp'    },
        { name: 'Voice', value: 'voice' },
        { name: 'Rep',   value: 'rep'   }
      ))
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const type    = interaction.options.getString('type') ?? 'xp'
    const page    = (interaction.options.getInteger('page') ?? 1) - 1
    const limit   = 10
    const guildId = interaction.guild.id

    const rows = db.getLeaderboard(guildId, type, limit, page * limit)
    if (!rows.length) {
      return interaction.editReply(infoCard(`${type.toUpperCase()} Leaderboard`, [`No data found for **${type}** leaderboard.`]))
    }

    const typeLabels = { xp: '\u2b50 XP', voice: '\u{1f399}\ufe0f Voice', rep: '\u{1f44d} Rep' }
    const medals = ['\u{1f947}', '\u{1f948}', '\u{1f949}']
    const offset = page * limit

    const lines = rows.map((row, i) => {
      const pos    = offset + i + 1
      const icon   = medals[pos - 1] ?? `**${pos}.**`
      const { level } = calcLevel(row.xp)

      let value
      if (type === 'xp')    value = `XP: **${row.xp}** | Level: **${level}**`
      if (type === 'voice') value = `Voice: **${row.voice_minutes}m**`
      if (type === 'rep')   value = `Rep: **${row.rep}**`

      return `${icon} <@${row.user_id}> \u2014 ${value ?? ''}`
    })

    await interaction.editReply(infoCard(`${typeLabels[type] ?? type} Leaderboard \u2014 ${interaction.guild.name}`, lines, {
      thumbnail: interaction.guild.iconURL() || undefined,
      subtext: `Page ${page + 1}`
    }))
  }
}
