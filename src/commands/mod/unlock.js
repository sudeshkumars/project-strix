'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { success } = require('../../../shared/embed')
const { safeSend } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel — restore @everyone send permissions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to unlock (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
        .setRequired(false)
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const channel = interaction.options.getChannel('channel') ?? interaction.channel
    const reason  = interaction.options.getString('reason') ?? 'No reason provided'
    const guild   = interaction.guild

    const me = guild.members.me
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({ content: '❌ I don\'t have permission to manage that channel.' })
    }

    const everyoneRole = guild.roles.everyone
    const existing     = channel.permissionOverwrites.cache.get(everyoneRole.id)

    // If not locked, nothing to do
    if (!existing?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: '🔓 That channel is not locked.' })
    }

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages:            null,  // null = inherit (remove override)
        SendMessagesInThreads:   null
      }, { reason: `[Stryx Unlock] ${reason} | Mod: ${interaction.user.tag}` })
    } catch (e) {
      return interaction.editReply({ content: `❌ Failed to unlock channel: ${e.message}` })
    }

    await safeSend(channel, {
      embeds: [
        success('Channel Unlocked', `🔓 This channel has been unlocked by ${interaction.user}.`)
      ]
    })

    await interaction.editReply({
      embeds: [success('Unlocked', `🔓 ${channel} has been unlocked.`)]
    })
  }
}
