'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db           = require('../../../shared/db')
const { info }     = require('../../../shared/embed')
const { calcLevel } = require('../../../shared/utils')

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
      return interaction.editReply({ content: `No data found for **${type}** leaderboard.` })
    }

    const typeLabels = { xp: '⭐ XP', voice: '🎙️ Voice', rep: '👍 Rep' }
    const embed = info(`${typeLabels[type] ?? type} Leaderboard — ${interaction.guild.name}`, null)
      .setFooter({ text: `Page ${page + 1}` })
      .setThumbnail(interaction.guild.iconURL())

    const medals = ['🥇', '🥈', '🥉']
    const offset = page * limit

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i]
      const pos    = offset + i + 1
      const icon   = medals[pos - 1] ?? `**${pos}.**`
      const { level } = calcLevel(row.xp)

      let value
      if (type === 'xp')    value = `XP: **${row.xp}** | Level: **${level}**`
      if (type === 'voice') value = `Voice: **${row.voice_minutes}m**`
      if (type === 'rep')   value = `Rep: **${row.rep}**`

      embed.addFields({
        name:  `${icon} <@${row.user_id}>`,
        value: value ?? '',
        inline: false
      })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
