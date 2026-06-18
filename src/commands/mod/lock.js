'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { successCard, errorCard } = require('../../../shared/components')
const { safeSend }               = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel \u2014 deny @everyone from sending messages')
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

    const me = guild.members.me
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply(errorCard('No Permission', ['I don\'t have permission to manage that channel.']))
    }

    const everyoneRole = guild.roles.everyone
    const existing     = channel.permissionOverwrites.cache.get(everyoneRole.id)

    if (existing?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply(successCard('Already Locked', ['\u{1f512} That channel is already locked.']))
    }

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages:       false,
        SendMessagesInThreads: false
      }, { reason: `[Stryx Lock] ${reason} | Mod: ${interaction.user.tag}` })
    } catch (e) {
      return interaction.editReply(errorCard('Failed', [`Could not lock channel: ${e.message}`]))
    }

    await safeSend(channel, successCard('Channel Locked', [`\u{1f512} This channel has been locked by ${interaction.user}.`, `**Reason:** ${reason}`]))

    await interaction.editReply(successCard('Locked', [`\u{1f512} ${channel} has been locked.`, `**Reason:** ${reason}`]))
  }
}
