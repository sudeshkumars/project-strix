'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                                           = require('../../../shared/db')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Configure level-up role rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Assign a role reward at a level')
      .addIntegerOption(o => o.setName('level').setDescription('Level required').setMinValue(1).setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a level role reward')
      .addIntegerOption(o => o.setName('level').setDescription('Level to remove').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all level role rewards')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'add') {
      const level = interaction.options.getInteger('level')
      const role  = interaction.options.getRole('role')

      if (role.managed) return interaction.editReply(errorCard('Invalid role', ['Cannot use bot-managed roles.']))
      if (role.id === interaction.guild.roles.everyone.id) return interaction.editReply(errorCard('Invalid role', ['Cannot use @everyone.']))

      db.setLevelRole(guildId, level, role.id)
      return interaction.editReply(successCard('Level Role Added', [`**Level ${level}** \u2192 ${role} reward set.`]))
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level')
      db.deleteLevelRole(guildId, level)
      return interaction.editReply(successCard('Removed', [`Level ${level} role reward removed.`]))
    }

    if (sub === 'list') {
      const roles = db.getLevelRoles(guildId)
      if (!roles.length) return interaction.editReply(infoCard('\u{1f396}\ufe0f Level Roles', ['No level roles configured.']))

      const lines = roles.map(r => `**Level ${r.level}** \u2014 <@&${r.role_id}>`)
      return interaction.editReply(infoCard('\u{1f396}\ufe0f Level Roles', lines))
    }
  }
}
