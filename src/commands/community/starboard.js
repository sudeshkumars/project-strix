'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const { updateConfig }                             = require('../../../shared/cache')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')

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
      .addStringOption(o => o.setName('emoji').setDescription('Star emoji (default \u2b50)').setRequired(false)))
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
      const emoji     = interaction.options.getString('emoji') ?? '\u2b50'

      updateConfig(client, guildId, {
        starboard_channel: channel.id,
        star_threshold:    threshold,
        star_emoji:        emoji
      }, {
        starboard_channel: channel.id,
        star_threshold:    threshold,
        star_emoji:        emoji
      })

      return interaction.editReply(successCard('Starboard Configured', [
        `**Channel** \u2014 ${channel}`,
        `**Threshold** \u2014 **${threshold}** ${emoji}`
      ]))
    }

    if (sub === 'disable') {
      updateConfig(client, guildId, { starboard_channel: null }, { starboard_channel: null })
      return interaction.editReply(successCard('Starboard Disabled', ['Starboard has been disabled.']))
    }

    if (sub === 'config') {
      return interaction.editReply(infoCard('\u2b50 Starboard Config', [
        `**Channel** \u2014 ${config?.starboard_channel ? `<#${config.starboard_channel}>` : 'Not set'}`,
        `**Threshold** \u2014 ${config?.star_threshold ?? 3}`,
        `**Emoji** \u2014 ${config?.star_emoji ?? '\u2b50'}`
      ]))
    }
  }
}
