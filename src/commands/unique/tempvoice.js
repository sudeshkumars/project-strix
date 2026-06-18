'use strict'

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Manage your temporary voice channel')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a temporary voice channel')
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(false).setMaxLength(32))
      .addIntegerOption(o => o.setName('limit').setDescription('User limit (0 = unlimited)').setMinValue(0).setMaxValue(99).setRequired(false)))
    .addSubcommand(s => s
      .setName('rename')
      .setDescription('Rename your voice channel')
      .addStringOption(o => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s
      .setName('limit')
      .setDescription('Set user limit')
      .addIntegerOption(o => o.setName('limit').setDescription('User limit (0 = unlimited)').setMinValue(0).setMaxValue(99).setRequired(true)))
    .addSubcommand(s => s
      .setName('lock')
      .setDescription('Lock/unlock your voice channel'))
    .addSubcommand(s => s
      .setName('kick')
      .setDescription('Kick a user from your voice channel')
      .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true)))
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete your voice channel')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const userId  = interaction.user.id
    const guild   = interaction.guild

    if (sub === 'create') {
      const existing = db.getTempVoiceByOwner(guild.id, userId)
      if (existing) return interaction.editReply({ embeds: [error('Already exists', `You already own <#${existing.channel_id}>. Delete it first.`)] })

      const name  = interaction.options.getString('name') ?? `${interaction.user.username}'s Channel`
      const limit = interaction.options.getInteger('limit') ?? 0

      let channel
      try {
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          userLimit: limit,
          permissionOverwrites: [
            {
              id: userId,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            }
          ]
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      db.createTempVoice(guild.id, channel.id, userId)
      return interaction.editReply({ embeds: [success('Voice Created', `Your channel ${channel} has been created.`)] })
    }

    // For all other subs, user must own a temp voice channel
    const vc = db.getTempVoiceByOwner(guild.id, userId)
    if (!vc) return interaction.editReply({ embeds: [error('No channel', 'You don\'t own a temp voice channel. Use `/vc create` first.')] })

    const channel = guild.channels.cache.get(vc.channel_id)
    if (!channel) {
      db.deleteTempVoice(vc.channel_id)
      return interaction.editReply({ embeds: [error('Not found', 'Your channel no longer exists.')] })
    }

    if (sub === 'rename') {
      const name = interaction.options.getString('name')
      try { await channel.setName(name) } catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }
      return interaction.editReply({ embeds: [success('Renamed', `Channel renamed to **${name}**.`)] })
    }

    if (sub === 'limit') {
      const limit = interaction.options.getInteger('limit')
      try { await channel.setUserLimit(limit) } catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }
      return interaction.editReply({ embeds: [success('Limit Set', `User limit set to **${limit === 0 ? 'unlimited' : limit}**.`)] })
    }

    if (sub === 'lock') {
      const everyone = guild.roles.everyone
      const isLocked = !channel.permissionsFor(everyone)?.has(PermissionFlagsBits.Connect)

      try {
        await channel.permissionOverwrites.edit(everyone.id, { Connect: isLocked ? null : false })
      } catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }

      return interaction.editReply({ embeds: [success(isLocked ? 'Unlocked' : 'Locked', `Channel is now **${isLocked ? 'unlocked' : 'locked'}**.`)] })
    }

    if (sub === 'kick') {
      const target = interaction.options.getUser('user')
      if (target.id === userId) return interaction.editReply({ embeds: [error('Invalid', 'Cannot kick yourself.')] })

      const member = guild.members.cache.get(target.id)
      if (!member?.voice?.channelId || member.voice.channelId !== channel.id) {
        return interaction.editReply({ embeds: [error('Not in channel', 'That user is not in your channel.')] })
      }

      try { await member.voice.disconnect('Kicked from temp VC') } catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }
      return interaction.editReply({ embeds: [success('Kicked', `${target} removed from your channel.`)] })
    }

    if (sub === 'delete') {
      try { await channel.delete('Owner deleted temp VC') } catch {}
      db.deleteTempVoice(vc.channel_id)
      return interaction.editReply({ embeds: [success('Deleted', 'Your temp voice channel has been deleted.')] })
    }
  }
}
