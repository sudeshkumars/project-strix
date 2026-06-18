'use strict'

const db                = require('../../../shared/db')
const { success, error } = require('../../../shared/embed')
const { generateHtmlTranscript } = require('../../../shared/transcript')
const { AttachmentBuilder } = require('discord.js')

module.exports = {
  id: 'ticket_close_reason',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const reason  = interaction.fields.getTextInputValue('close_reason')
    const ticket  = db.getTicketByChannel(interaction.channel.id)

    if (!ticket) {
      return interaction.editReply({ embeds: [error('Not a ticket', 'This channel is not a ticket.')] })
    }

    const { resolveTier, TIERS } = require('../../../shared/permissions')
    const tier = resolveTier(interaction.member, config)
    if (ticket.user_id !== interaction.user.id && tier < TIERS.MOD) {
      return interaction.editReply({ embeds: [error('No permission', 'Only the ticket owner or a mod can close this.')] })
    }

    // Generate HTML transcript
    let transcriptPath = null
    try {
      const opener = await client.users.fetch(ticket.user_id).catch(() => ({ tag: 'Unknown' }))
      transcriptPath = await generateHtmlTranscript(interaction.channel, ticket.ticket_id, {
        openedBy:  opener.tag,
        guildName: interaction.guild.name,
        category:  ticket.category ?? 'General',
        closedBy:  interaction.user.tag
      })
    } catch {}

    db.updateTicket(ticket.ticket_id, {
      status:     'closed',
      closed_at:  Math.floor(Date.now() / 1000),
      transcript: transcriptPath ?? null
    })

    // Send transcript to log channel
    const logId = config?.case_channel ?? config?.log_channel
    if (logId && transcriptPath) {
      const logCh = interaction.guild.channels.cache.get(logId)
      if (logCh) {
        const file = new AttachmentBuilder(transcriptPath, { name: `ticket-${ticket.ticket_id}.html` })
        await logCh.send({
          content: `📄 Ticket **#${ticket.ticket_id}** closed by ${interaction.user}\n**Reason:** ${reason}`,
          files: [file]
        }).catch(() => {})
      }
    }

    await interaction.editReply({ embeds: [success('Ticket Closing', 'Transcript saved. Channel deletes in 5 seconds.')] })
    setTimeout(async () => {
      try { await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}: ${reason}`) } catch {}
    }, 5000)
  }
}
