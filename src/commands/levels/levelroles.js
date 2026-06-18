'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                   = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')

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

      if (role.managed) return interaction.editReply({ embeds: [error('Invalid role', 'Cannot use bot-managed roles.')] })
      if (role.id === interaction.guild.roles.everyone.id) return interaction.editReply({ embeds: [error('Invalid role', 'Cannot use @everyone.')] })

      db.setLevelRole(guildId, level, role.id)
      return interaction.editReply({ embeds: [success('Level Role Added', `**Level ${level}** → ${role} reward set.`)] })
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level')
      db.deleteLevelRole(guildId, level)
      return interaction.editReply({ embeds: [success('Removed', `Level ${level} role reward removed.`)] })
    }

    if (sub === 'list') {
      const roles = db.getLevelRoles(guildId)
      if (!roles.length) return interaction.editReply({ content: 'No level roles configured.' })

      const embed = info('🎖️ Level Roles', null)
      for (const r of roles) {
        embed.addFields({ name: `Level ${r.level}`, value: `<@&${r.role_id}>`, inline: true })
      }
      return interaction.editReply({ embeds: [embed] })
    }
  }
}
