'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                         = require('../../../shared/db')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('View invite stats')
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View your invite stats'))
    .addSubcommand(s => s
      .setName('user')
      .setDescription('View another user\'s invite stats')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)))
    .addSubcommand(s => s
      .setName('leaderboard')
      .setDescription('Top 10 inviters'))
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('Reset invite tracking for this guild')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'view') {
      const stats = db.getInviterStats(guildId, interaction.user.id)
      return interaction.editReply(infoCard('Your Invites', [
        `**Total:** ${stats?.total || 0}`,
        `**Real:** ${stats?.real || 0}`,
        `**Fake:** ${stats?.fake || 0}`,
        `**Left:** ${stats?.left || 0}`
      ]))
    }

    if (sub === 'user') {
      const target = interaction.options.getUser('user')
      const stats  = db.getInviterStats(guildId, target.id)
      return interaction.editReply(infoCard(`Invites for ${target.username}`, [
        `**Total:** ${stats?.total || 0}`,
        `**Real:** ${stats?.real || 0}`,
        `**Fake:** ${stats?.fake || 0}`,
        `**Left:** ${stats?.left || 0}`
      ]))
    }

    if (sub === 'leaderboard') {
      const board = db.getInviteLeaderboard(guildId, 10)
      if (!board.length) {
        return interaction.editReply(infoCard('Invite Leaderboard', ['No invites tracked yet.']))
      }

      const lines = board.map((r, i) =>
        `**${i + 1}.** <@${r.inviter_id}> - **${r.real}** real (${r.total} total, ${r.fake} fake, ${r.left} left)`
      )

      return interaction.editReply(infoCard('Invite Leaderboard', lines))
    }

    if (sub === 'reset') {
      // Check admin permission
      const { resolveTier, meetsRequirement } = require('../../../shared/permissions')
      const tier = resolveTier(interaction.member, interaction.guildConfig)
      if (!meetsRequirement(tier, 'admin')) {
        return interaction.editReply(errorCard('No Permission', ['Only admins can reset invite tracking.']))
      }

      db.getDb().prepare('DELETE FROM invite_tracking WHERE guild_id = ?').run(guildId)
      return interaction.editReply(successCard('Invites Reset', ['All invite tracking data has been cleared.']))
    }
  }
}
