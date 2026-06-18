'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { success, warn } = require('../../../shared/embed')
const { safeSend, sleep } = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock ALL text channels server-wide')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Lock all channels')
        .addStringOption(o => o.setName('reason').setDescription('Reason for lockdown').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Restore all channels (lift lockdown)')
    ),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guild   = interaction.guild
    const reason  = interaction.options.getString('reason') ?? 'No reason provided'
    const isStart = sub === 'start'

    const everyoneRole = guild.roles.everyone
    const me           = guild.members.me

    // Fetch all text channels the bot can manage
    const channels = guild.channels.cache.filter(ch =>
      (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildForum) &&
      ch.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)
    )

    if (!channels.size) {
      return interaction.editReply({ content: '❌ No manageable text channels found.' })
    }

    let success_count = 0
    let fail_count    = 0

    for (const [, channel] of channels) {
      try {
        if (isStart) {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages:          false,
            SendMessagesInThreads: false
          }, { reason: `[Stryx Lockdown] ${reason} | Mod: ${interaction.user.tag}` })
        } else {
          const existing = channel.permissionOverwrites.cache.get(everyoneRole.id)
          if (existing?.deny.has(PermissionFlagsBits.SendMessages)) {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages:          null,
              SendMessagesInThreads: null
            }, { reason: `[Stryx Lockdown End] | Mod: ${interaction.user.tag}` })
          }
        }
        success_count++
      } catch {
        fail_count++
      }
      // Avoid rate limits
      await sleep(200)
    }

    // Post notice in current channel
    const noticeEmbed = isStart
      ? warn('🔒 Server Lockdown', `This server has been locked down by ${interaction.user}.\n**Reason:** ${reason}\n\nAll channels are temporarily restricted. Please wait for further instructions.`)
      : success('🔓 Lockdown Lifted', `The server lockdown has been lifted by ${interaction.user}. Channels are now open.`)

    await safeSend(interaction.channel, { embeds: [noticeEmbed] })

    const resultEmbed = isStart
      ? warn('Lockdown Started', `🔒 Locked **${success_count}** channels.${fail_count ? ` (${fail_count} failed — missing perms)` : ''}\n**Reason:** ${reason}`)
      : success('Lockdown Ended', `🔓 Unlocked **${success_count}** channels.${fail_count ? ` (${fail_count} skipped)` : ''}`)

    await interaction.editReply({ embeds: [resultEmbed] })
  }
}
