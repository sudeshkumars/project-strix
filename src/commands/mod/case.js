'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db          = require('../../../shared/db')
const { info, success, error } = require('../../../shared/embed')
const { relativeTime, fullTime } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View or edit a mod case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View a case')
      .addIntegerOption(o => o.setName('id').setDescription('Case ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('reason')
      .setDescription('Update a case reason')
      .addIntegerOption(o => o.setName('id').setDescription('Case ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('New reason').setRequired(true)))
    .addSubcommand(s => s
      .setName('history')
      .setDescription('View case history for a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('page').setDescription('Page').setMinValue(1).setRequired(false))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'view') {
      const caseId  = interaction.options.getInteger('id')
      const caseRow = db.getCase(caseId, guildId)
      if (!caseRow) return interaction.editReply({ embeds: [error('Not found', `Case #${caseId} not found.`)] })

      const embed = info(`📋 Case #${caseId}`, null)
        .addFields(
          { name: 'Type',    value: caseRow.type,   inline: true },
          { name: 'Active',  value: caseRow.active ? 'Yes' : 'No', inline: true },
          { name: 'User',    value: `<@${caseRow.user_id}>`, inline: true },
          { name: 'Mod',     value: `<@${caseRow.mod_id}>`,  inline: true },
          { name: 'Created', value: fullTime(caseRow.created_at), inline: true },
          { name: 'Reason',  value: caseRow.reason ?? 'None', inline: false }
        )

      if (caseRow.expires_at) {
        embed.addFields({ name: 'Expires', value: relativeTime(caseRow.expires_at), inline: true })
      }

      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'reason') {
      const caseId = interaction.options.getInteger('id')
      const reason = interaction.options.getString('reason')
      const row    = db.getCase(caseId, guildId)
      if (!row) return interaction.editReply({ embeds: [error('Not found', `Case #${caseId} not found.`)] })

      db.updateCaseReason(caseId, guildId, reason)
      return interaction.editReply({ embeds: [success('Case Updated', `Case **#${caseId}** reason updated.`)] })
    }

    if (sub === 'history') {
      const target = interaction.options.getUser('user')
      const page   = (interaction.options.getInteger('page') ?? 1) - 1
      const limit  = 8
      const cases  = db.getCases(guildId, target.id, limit, page * limit)
      const total  = db.getCaseCount(guildId, target.id).count

      if (!cases.length) {
        return interaction.editReply({ content: `No cases found for **${target.tag}**.` })
      }

      const embed = info(`📋 Cases — ${target.tag}`, null)
        .setFooter({ text: `Page ${page + 1} • Total: ${total}` })

      for (const c of cases) {
        embed.addFields({
          name:  `#${c.case_id} — ${c.type.toUpperCase()} — ${relativeTime(c.created_at)}`,
          value: `**Reason:** ${c.reason ?? 'None'} | **Mod:** <@${c.mod_id}>`,
          inline: false
        })
      }

      return interaction.editReply({ embeds: [embed] })
    }
  }
}
