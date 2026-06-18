'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { successCard, errorCard } = require('../../../shared/components')
const { safeSend }               = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel \u2014 restore @everyone send permissions')
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
      return interaction.editReply(errorCard('No Permission', ['I don\'t have permission to manage that channel.']))
    }

    const everyoneRole = guild.roles.everyone
    const existing     = channel.permissionOverwrites.cache.get(everyoneRole.id)

    if (!existing?.deny.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply(successCard('Not Locked', ['\u{1f513} That channel is not locked.']))
    }

    try {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages:            null,
        SendMessagesInThreads:   null
      }, { reason: `[Stryx Unlock] ${reason} | Mod: ${interaction.user.tag}` })
    } catch (e) {
      return interaction.editReply(errorCard('Failed', [`Could not unlock channel: ${e.message}`]))
    }

    await safeSend(channel, successCard('Channel Unlocked', [`\u{1f513} This channel has been unlocked by ${interaction.user}.`]))

    await interaction.editReply(successCard('Unlocked', [`\u{1f513} ${channel} has been unlocked.`]))
  }
}
