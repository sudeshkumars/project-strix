'use strict'

const {
  ChannelType, PermissionFlagsBits
} = require('discord.js')
const db           = require('../../../shared/db')
const { info, error } = require('../../../shared/embed')
const { safeSend } = require('../../../shared/utils')

module.exports = {
  id: 'ticket_open',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const guild = interaction.guild
    const user  = interaction.user

    // Check for existing ticket
    const existing = db.getOpenTickets(guild.id).find(t => t.user_id === user.id)
    if (existing) {
      return interaction.editReply({
        embeds: [error('Ticket exists', `You already have an open ticket: <#${existing.channel_id}>`)]
      })
    }

    const supportRole    = config?.ticket_support_role
    const ticketCategory = config?.ticket_category
      ? guild.channels.cache.get(config.ticket_category)
      : null

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]

    if (supportRole) {
      overwrites.push({
        id: supportRole,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      })
    }

    let channel
    try {
      channel = await guild.channels.create({
        name: `ticket-${user.username.toLowerCase().replace(/\s/g, '-')}`,
        type: ChannelType.GuildText,
        parent: ticketCategory?.id ?? null,
        permissionOverwrites: overwrites,
        topic: `Ticket by ${user.tag}`
      })
    } catch (e) {
      return interaction.editReply({ embeds: [error('Failed', `Could not create ticket: ${e.message}`)] })
    }

    const ticketId = db.createTicket(guild.id, user.id, channel.id)

    const embed = info(`🎫 Ticket #${ticketId}`, null)
      .addFields({ name: 'Opened by', value: `${user}`, inline: true })
      .setFooter({ text: 'Use /ticket close to close this ticket.' })

    await safeSend(channel, {
      content: supportRole ? `<@&${supportRole}> — New ticket from ${user}` : `New ticket from ${user}`,
      embeds:  [embed]
    })

    await interaction.editReply({
      embeds: [info('Ticket Opened', `Your ticket is ready: ${channel}`)]
    })
  }
}
