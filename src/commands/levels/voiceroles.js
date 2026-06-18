'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db = require('../../../shared/db')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('voiceroles')
    .setDescription('Configure voice activity role rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a voice role reward')
      .addIntegerOption(o => o.setName('minutes').setDescription('Total minutes needed').setMinValue(1).setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a voice role')
      .addIntegerOption(o => o.setName('minutes').setDescription('Minutes threshold to remove').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all voice role rewards')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'add') {
      const minutes = interaction.options.getInteger('minutes')
      const role    = interaction.options.getRole('role')

      if (role.managed) {
        return interaction.editReply(errorCard('Invalid Role', ['Cannot use bot-managed roles.']))
      }
      if (role.id === interaction.guild.roles.everyone.id) {
        return interaction.editReply(errorCard('Invalid Role', ['Cannot use @everyone.']))
      }

      db.setVoiceRole(guildId, minutes, role.id)
      return interaction.editReply(successCard('Voice Role Added', [
        `**${minutes} minutes** → ${role} reward set.`
      ]))
    }

    if (sub === 'remove') {
      const minutes = interaction.options.getInteger('minutes')
      db.deleteVoiceRole(guildId, minutes)
      return interaction.editReply(successCard('Removed', [
        `Voice role at **${minutes} minutes** removed.`
      ]))
    }

    if (sub === 'list') {
      const roles = db.getVoiceRoles(guildId)
      if (!roles.length) {
        return interaction.editReply(infoCard('Voice Roles', ['No voice roles configured.']))
      }

      const lines = capList(roles, 15, r => `**${r.minutes} min** → <@&${r.role_id}>`)
      return interaction.editReply(infoCard('Voice Roles', lines))
    }
  }
}
