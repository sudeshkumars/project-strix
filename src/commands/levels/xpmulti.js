'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('xpmulti')
    .setDescription('Manage XP multiplier roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set an XP multiplier for a role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addNumberOption(o => o.setName('multiplier').setDescription('Multiplier e.g. 1.5 = 50% bonus').setMinValue(0.1).setMaxValue(10).setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a multiplier from a role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all XP multipliers')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'set') {
      const role       = interaction.options.getRole('role')
      const multiplier = interaction.options.getNumber('multiplier')

      db.getDb().prepare(`
        INSERT INTO xp_multipliers (guild_id, role_id, multiplier)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, role_id) DO UPDATE SET multiplier = ?
      `).run(guildId, role.id, multiplier, multiplier)

      return interaction.editReply({
        embeds: [success('Multiplier Set', `${role} now grants **${multiplier}x** XP.`)]
      })
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role')
      db.getDb().prepare('DELETE FROM xp_multipliers WHERE guild_id = ? AND role_id = ?').run(guildId, role.id)
      return interaction.editReply({ embeds: [success('Removed', `Multiplier removed from ${role}.`)] })
    }

    if (sub === 'list') {
      const rows = db.getDb().prepare('SELECT * FROM xp_multipliers WHERE guild_id = ? ORDER BY multiplier DESC').all(guildId)
      if (!rows.length) return interaction.editReply({ content: 'No XP multipliers set.' })

      const embed = info('⚡ XP Multipliers', null)
      for (const r of rows) {
        embed.addFields({ name: `<@&${r.role_id}>`, value: `**${r.multiplier}x**`, inline: true })
      }
      return interaction.editReply({ embeds: [embed] })
    }
  }
}
