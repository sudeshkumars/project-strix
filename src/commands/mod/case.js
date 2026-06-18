'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                                           = require('../../../shared/db')
const { infoCard, successCard, errorCard, capList } = require('../../../shared/components')
const { relativeTime, fullTime }                   = require('../../../shared/utils')

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
      if (!caseRow) return interaction.editReply(errorCard('Not found', [`Case #${caseId} not found.`]))

      const lines = [
        `**Type** \u2014 ${caseRow.type}`,
        `**Active** \u2014 ${caseRow.active ? 'Yes' : 'No'}`,
        `**User** \u2014 <@${caseRow.user_id}>`,
        `**Mod** \u2014 <@${caseRow.mod_id}>`,
        `**Created** \u2014 ${fullTime(caseRow.created_at)}`,
        `**Reason** \u2014 ${caseRow.reason ?? 'None'}`
      ]

      if (caseRow.expires_at) {
        lines.push(`**Expires** \u2014 ${relativeTime(caseRow.expires_at)}`)
      }

      return interaction.editReply(infoCard(`\u{1f4cb} Case #${caseId}`, lines))
    }

    if (sub === 'reason') {
      const caseId = interaction.options.getInteger('id')
      const reason = interaction.options.getString('reason')
      const row    = db.getCase(caseId, guildId)
      if (!row) return interaction.editReply(errorCard('Not found', [`Case #${caseId} not found.`]))

      db.updateCaseReason(caseId, guildId, reason)
      return interaction.editReply(successCard('Case Updated', [`Case **#${caseId}** reason updated.`]))
    }

    if (sub === 'history') {
      const target = interaction.options.getUser('user')
      const page   = (interaction.options.getInteger('page') ?? 1) - 1
      const limit  = 8
      const cases  = db.getCases(guildId, target.id, limit, page * limit)
      const total  = db.getCaseCount(guildId, target.id).count

      if (!cases.length) {
        return interaction.editReply(infoCard(`\u{1f4cb} Cases \u2014 ${target.tag}`, ['No cases found.']))
      }

      const lines = cases.map(c =>
        `**#${c.case_id}** \u2014 ${c.type.toUpperCase()} \u2014 ${relativeTime(c.created_at)}\n> Reason: ${c.reason ?? 'None'} | Mod: <@${c.mod_id}>`
      )

      return interaction.editReply(infoCard(`\u{1f4cb} Cases \u2014 ${target.tag}`, lines, {
        subtext: `Page ${page + 1} \u2022 Total: ${total}`
      }))
    }
  }
}
