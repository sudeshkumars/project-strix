'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }         = require('../../../shared/cache')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure the starboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Set up the starboard')
      .addChannelOption(o => o.setName('channel').setDescription('Starboard channel').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription('Stars required (default 3)').setMinValue(1).setRequired(false))
      .addStringOption(o => o.setName('emoji').setDescription('Star emoji (default ⭐)').setRequired(false)))
    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Disable the starboard'))
    .addSubcommand(s => s
      .setName('config')
      .setDescription('View starboard config')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig

    if (sub === 'setup') {
      const channel   = interaction.options.getChannel('channel')
      const threshold = interaction.options.getInteger('threshold') ?? 3
      const emoji     = interaction.options.getString('emoji') ?? '⭐'

      updateConfig(client, guildId, {
        starboard_channel: channel.id,
        star_threshold:    threshold,
        star_emoji:        emoji
      }, {
        starboard_channel: channel.id,
        star_threshold:    threshold,
        star_emoji:        emoji
      })

      return interaction.editReply({
        embeds: [success('Starboard Configured', `Channel: ${channel}\nThreshold: **${threshold}** ${emoji}`)]
      })
    }

    if (sub === 'disable') {
      updateConfig(client, guildId, { starboard_channel: null }, { starboard_channel: null })
      return interaction.editReply({ embeds: [success('Starboard Disabled', 'Starboard has been disabled.')] })
    }

    if (sub === 'config') {
      const embed = info('⭐ Starboard Config', null)
        .addFields(
          { name: 'Channel',   value: config?.starboard_channel ? `<#${config.starboard_channel}>` : 'Not set', inline: true },
          { name: 'Threshold', value: String(config?.star_threshold ?? 3), inline: true },
          { name: 'Emoji',     value: config?.star_emoji ?? '⭐', inline: true }
        )
      return interaction.editReply({ embeds: [embed] })
    }
  }
}
