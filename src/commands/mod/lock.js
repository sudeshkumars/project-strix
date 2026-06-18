'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { success, error } = require('../../../shared/embed')
const { safeSend }       = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel — deny @everyone from sending messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to lock (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
        .setRequired(false)
    )
    .addStringOption(o => o.setName('reason').setDescription('Reason for locking').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const channel = interaction.options.getChannel('channel') ?? interaction.channel
    const reason  = interaction.options.getString('reason') ?? 'No reason provided'
    const guild   = interaction.guild

    // Check bot perms on that channel
    const me = guild.members.me
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({ content: '❌ I don\'t have permission to manage that channel.' })
    }

    // Get current @everyone override
    const everyoneRole = guild.roles.everyone
    const existing     = channel.permissionOverwrites.cache.get(everyoneRole.id)

    // Check already locked
    if (existing?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: '🔒 That channel is already locked.' })
    }

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages:       false,
        SendMessagesInThreads: false
      }, { reason: `[Stryx Lock] ${reason} | Mod: ${interaction.user.tag}` })
    } catch (e) {
      return interaction.editReply({ content: `❌ Failed to lock channel: ${e.message}` })
    }

    await safeSend(channel, {
      embeds: [
        success('Channel Locked', `🔒 This channel has been locked by ${interaction.user}.\n**Reason:** ${reason}`)
      ]
    })

    await interaction.editReply({
      embeds: [success('Locked', `🔒 ${channel} has been locked.\n**Reason:** ${reason}`)]
    })
  }
}
