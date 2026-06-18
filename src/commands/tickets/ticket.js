'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, PermissionOverwrites
} = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { safeSend }             = require('../../../shared/utils')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system')
    .addSubcommand(s => s
      .setName('open')
      .setDescription('Open a support ticket')
      .addStringOption(o => o.setName('category').setDescription('Ticket category').setRequired(false))
      .addStringOption(o => o.setName('reason').setDescription('Brief description').setRequired(false)))
    .addSubcommand(s => s
      .setName('close')
      .setDescription('Close this ticket')
      .addStringOption(o => o.setName('reason').setDescription('Close reason').setRequired(false)))
    .addSubcommand(s => s
      .setName('claim')
      .setDescription('Claim this ticket (mod only)'))
    .addSubcommand(s => s
      .setName('unclaim')
      .setDescription('Unclaim this ticket'))
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a user to this ticket')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a user from this ticket')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s
      .setName('priority')
      .setDescription('Set ticket priority (mod only)')
      .addStringOption(o => o.setName('level').setDescription('Priority').setRequired(true)
        .addChoices(
          { name: 'Low',    value: 'low'    },
          { name: 'Medium', value: 'medium' },
          { name: 'High',   value: 'high'   },
          { name: 'Urgent', value: 'urgent' }
        )))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List open tickets (mod only)'))
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('Ticket statistics (mod only)'))
    .addSubcommand(s => s
      .setName('assign')
      .setDescription('Assign this ticket to a mod')
      .addUserOption(o => o.setName('mod').setDescription('Mod to assign to').setRequired(true)))
    .addSubcommand(s => s
      .setName('reopen')
      .setDescription('Reopen a closed ticket by ID')
      .addIntegerOption(o => o.setName('id').setDescription('Ticket ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('transcript')
      .setDescription('Retrieve HTML transcript for a ticket')
      .addIntegerOption(o => o.setName('id').setDescription('Ticket ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guild   = interaction.guild
    const config  = interaction.guildConfig
    const user    = interaction.user

    // ── open ──────────────────────────────────────────────────────────────────
    if (sub === 'open') {
      const category = interaction.options.getString('category') ?? 'General'
      const reason   = interaction.options.getString('reason') ?? 'No description provided'

      // Check existing open ticket
      const existing = db.getOpenTickets(guild.id).find(t => t.user_id === user.id)
      if (existing) {
        return interaction.editReply({
          embeds: [error('Ticket exists', `You already have an open ticket: <#${existing.channel_id}>`)]
        })
      }

      // Create channel
      const ticketCategory = config?.ticket_category
        ? guild.channels.cache.get(config.ticket_category)
        : null

      const supportRole = config?.ticket_support_role

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
          topic: `Ticket by ${user.tag} | Category: ${category}`
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', `Could not create ticket channel: ${e.message}`)] })
      }

      const ticketId = db.createTicket(guild.id, user.id, channel.id, category)

      // Welcome message in ticket
      const embed = info(`🎫 Ticket #${ticketId} — ${category}`, null)
        .addFields(
          { name: 'Opened by', value: `${user}`, inline: true },
          { name: 'Category',  value: category,  inline: true },
          { name: 'Reason',    value: reason,     inline: false }
        )
        .setFooter({ text: 'Use /ticket close to close this ticket.' })

      await safeSend(channel, {
        content: supportRole ? `<@&${supportRole}> — New ticket from ${user}` : `New ticket from ${user}`,
        embeds:  [embed]
      })

      return interaction.editReply({
        embeds: [success('Ticket Opened', `Your ticket has been created: ${channel}`)]
      })
    }

    // ── close ─────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      const reason = interaction.options.getString('reason') ?? 'No reason provided'
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })

      // Only ticket owner or mod can close
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      const tier = resolveTier(interaction.member, config)
      if (ticket.user_id !== user.id && tier < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Only the ticket owner or a mod can close this.')] })
      }

      // Generate HTML transcript
      const { generateHtmlTranscript } = require('../../../shared/transcript')
      const { AttachmentBuilder }      = require('discord.js')

      let transcriptPath = null
      try {
        transcriptPath = await generateHtmlTranscript(interaction.channel, ticket.ticket_id, {
          openedBy:  (await interaction.client.users.fetch(ticket.user_id).catch(() => ({ tag: 'Unknown' }))).tag,
          guildName: interaction.guild.name,
          category:  ticket.category ?? 'General',
          closedBy:  user.tag
        })
      } catch {}

      db.updateTicket(ticket.ticket_id, {
        status:    'closed',
        closed_at: Math.floor(Date.now() / 1000),
        transcript: transcriptPath ?? null
      })

      // Send transcript to log/case channel
      const logChannelId = config?.case_channel ?? config?.log_channel
      if (logChannelId && transcriptPath) {
        const logCh = interaction.guild.channels.cache.get(logChannelId)
        if (logCh) {
          const file = new AttachmentBuilder(transcriptPath, { name: `ticket-${ticket.ticket_id}.html` })
          await logCh.send({
            content: `📄 Transcript for ticket **#${ticket.ticket_id}** (closed by ${user})`,
            files: [file]
          }).catch(() => {})
        }
      }

      await interaction.editReply({ embeds: [success('Ticket Closing', 'Transcript saved. Channel deletes in 5 seconds.')] })

      setTimeout(async () => {
        try { await interaction.channel.delete(`Ticket closed by ${user.tag}: ${reason}`) } catch {}
      }, 5000)

      return
    }

    // ── claim ─────────────────────────────────────────────────────────────────
    if (sub === 'claim') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Only mods can claim tickets.')] })
      }

      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })
      if (ticket.claimed_by) return interaction.editReply({ embeds: [error('Already claimed', `This ticket is claimed by <@${ticket.claimed_by}>.`)] })

      db.updateTicket(ticket.ticket_id, { claimed_by: user.id, status: 'claimed' })
      return interaction.editReply({ embeds: [success('Ticket Claimed', `You have claimed ticket #${ticket.ticket_id}.`)] })
    }

    // ── unclaim ───────────────────────────────────────────────────────────────
    if (sub === 'unclaim') {
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })
      if (ticket.claimed_by !== user.id) return interaction.editReply({ embeds: [error('Not claimed by you', 'You have not claimed this ticket.')] })

      db.updateTicket(ticket.ticket_id, { claimed_by: null, status: 'open' })
      return interaction.editReply({ embeds: [success('Unclaimed', 'Ticket unclaimed.')] })
    }

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const target = interaction.options.getUser('user')
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })

      try {
        await interaction.channel.permissionOverwrites.create(target.id, {
          ViewChannel:        true,
          SendMessages:       true,
          ReadMessageHistory: true
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      return interaction.editReply({ embeds: [success('User Added', `${target} has been added to this ticket.`)] })
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const target = interaction.options.getUser('user')
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })
      if (target.id === ticket.user_id) return interaction.editReply({ embeds: [error('Cannot remove', 'Cannot remove the ticket owner.')] })

      try {
        await interaction.channel.permissionOverwrites.delete(target.id)
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', e.message)] })
      }

      return interaction.editReply({ embeds: [success('User Removed', `${target} has been removed from this ticket.`)] })
    }

    // ── priority ──────────────────────────────────────────────────────────────
    if (sub === 'priority') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Only mods can set priority.')] })
      }

      const level  = interaction.options.getString('level')
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })

      db.updateTicket(ticket.ticket_id, { priority: level })

      const icons = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' }
      return interaction.editReply({ embeds: [success('Priority Updated', `Ticket priority set to ${icons[level]} **${level}**.`)] })
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Mods only.')] })
      }

      const tickets = db.getOpenTickets(guild.id)
      if (!tickets.length) return interaction.editReply({ content: '✅ No open tickets.' })

      const icons = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴', open: '⬜', claimed: '🔵' }
      const embed = info(`🎫 Open Tickets (${tickets.length})`, null)

      for (const t of tickets.slice(0, 20)) {
        embed.addFields({
          name:  `#${t.ticket_id} — ${t.category ?? 'General'} ${icons[t.priority] ?? ''}`,
          value: `<#${t.channel_id}> | <@${t.user_id}> | ${icons[t.status] ?? ''} ${t.status}${t.claimed_by ? ` | Claimed: <@${t.claimed_by}>` : ''}`,
          inline: false
        })
      }

      return interaction.editReply({ embeds: [embed] })
    }

    // ── stats ─────────────────────────────────────────────────────────────────
    if (sub === 'stats') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Mods only.')] })
      }

      const stats = db.getTicketStats(guild.id)
      const embed = info('🎫 Ticket Stats', null)
        .addFields(
          { name: 'Total',   value: String(stats.total),   inline: true },
          { name: 'Open',    value: String(stats.open),    inline: true },
          { name: 'Claimed', value: String(stats.claimed), inline: true },
          { name: 'Closed',  value: String(stats.closed),  inline: true }
        )

      return interaction.editReply({ embeds: [embed] })
    }

    // ── assign ────────────────────────────────────────────────────────────────
    if (sub === 'assign') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Mods only.')] })
      }

      const mod    = interaction.options.getUser('mod')
      const ticket = db.getTicketByChannel(interaction.channel.id)
      if (!ticket) return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })

      db.updateTicket(ticket.ticket_id, { claimed_by: mod.id, status: 'claimed' })

      await safeSend(interaction.channel, { content: `📌 Ticket assigned to ${mod} by ${user}.` })
      return interaction.editReply({ embeds: [success('Assigned', `Ticket **#${ticket.ticket_id}** assigned to ${mod}.`)] })
    }

    // ── reopen ────────────────────────────────────────────────────────────────
    if (sub === 'reopen') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Mods only.')] })
      }

      const ticketId = interaction.options.getInteger('id')
      const ticket   = db.getTicket(ticketId)
      if (!ticket || ticket.guild_id !== guild.id) {
        return interaction.editReply({ embeds: [error('Not found', `Ticket #${ticketId} not found.`)] })
      }
      if (ticket.status !== 'closed') {
        return interaction.editReply({ embeds: [error('Not closed', `Ticket #${ticketId} is not closed.`)] })
      }

      // Recreate channel
      const { ChannelType, PermissionFlagsBits: PF } = require('discord.js')
      const supportRole = config?.ticket_support_role
      const ticketCat   = config?.ticket_category ? guild.channels.cache.get(config.ticket_category) : null

      let newChannel
      try {
        const opener = await client.users.fetch(ticket.user_id).catch(() => null)
        newChannel = await guild.channels.create({
          name: `ticket-${opener?.username?.toLowerCase() ?? ticketId}`,
          type: ChannelType.GuildText,
          parent: ticketCat?.id ?? null,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PF.ViewChannel] },
            ...(ticket.user_id ? [{ id: ticket.user_id, allow: [PF.ViewChannel, PF.SendMessages, PF.ReadMessageHistory] }] : []),
            ...(supportRole ? [{ id: supportRole, allow: [PF.ViewChannel, PF.SendMessages, PF.ReadMessageHistory, PF.ManageMessages] }] : [])
          ]
        })
      } catch (e) {
        return interaction.editReply({ embeds: [error('Failed', `Could not create channel: ${e.message}`)] })
      }

      db.updateTicket(ticketId, { status: 'open', channel_id: newChannel.id, closed_at: null, claimed_by: null })
      await safeSend(newChannel, { content: `🔄 Ticket **#${ticketId}** reopened by ${user}.` })

      return interaction.editReply({ embeds: [success('Ticket Reopened', `Ticket **#${ticketId}** → ${newChannel}`)] })
    }

    // ── transcript ────────────────────────────────────────────────────────────
    if (sub === 'transcript') {
      const { resolveTier, TIERS } = require('../../../shared/permissions')
      if (resolveTier(interaction.member, config) < TIERS.MOD) {
        return interaction.editReply({ embeds: [error('No permission', 'Mods only.')] })
      }

      const ticketId = interaction.options.getInteger('id')
      const ticket   = db.getTicket(ticketId)
      if (!ticket || ticket.guild_id !== guild.id) {
        return interaction.editReply({ embeds: [error('Not found', `Ticket #${ticketId} not found.`)] })
      }

      const { AttachmentBuilder } = require('discord.js')
      const fs   = require('fs')
      const path = require('path')

      // Try stored transcript file first
      const storedPath = ticket.transcript
      if (storedPath && fs.existsSync(storedPath)) {
        const file = new AttachmentBuilder(storedPath, { name: `ticket-${ticketId}.html` })
        return interaction.editReply({ content: `📄 Transcript for ticket **#${ticketId}**`, files: [file] })
      }

      // Try to generate from channel if still exists
      const liveChannel = guild.channels.cache.get(ticket.channel_id)
      if (!liveChannel) {
        return interaction.editReply({ embeds: [error('Not available', 'Transcript file not found and channel no longer exists.')] })
      }

      const { generateHtmlTranscript } = require('../../../shared/transcript')
      const opener = await client.users.fetch(ticket.user_id).catch(() => ({ tag: 'Unknown' }))
      const filePath = await generateHtmlTranscript(liveChannel, ticketId, {
        openedBy:  opener.tag,
        guildName: guild.name,
        category:  ticket.category ?? 'General',
        closedBy:  'N/A (live)'
      })

      const file = new AttachmentBuilder(filePath, { name: `ticket-${ticketId}.html` })
      return interaction.editReply({ content: `📄 Live transcript for ticket **#${ticketId}**`, files: [file] })
    }
  }
}

// ─── Transcript generator ─────────────────────────────────────────────────────
async function generateTranscript (channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 })
    const lines    = messages
      .reverse()
      .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[embed/attachment]'}`)
    return lines.join('\n')
  } catch {
    return ''
  }
}
