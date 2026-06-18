'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                         = require('../../../shared/db')
const { successCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('pardon')
    .setDescription('Pardon (remove) a warning by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption(o => o.setName('warn_id').setDescription('Warning ID').setRequired(true)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const warnId = interaction.options.getInteger('warn_id')
    const guildId = interaction.guild.id

    const warns = db.getDb().prepare('SELECT * FROM warnings WHERE warn_id = ? AND guild_id = ?').get(warnId, guildId)
    if (!warns) return interaction.editReply(errorCard('Not found', [`Warning #${warnId} not found in this server.`]))
    if (warns.pardoned) return interaction.editReply(errorCard('Already pardoned', [`Warning #${warnId} is already pardoned.`]))

    db.pardonWarning(warnId, guildId)

    await interaction.editReply(successCard('Warning Pardoned', [`Warning **#${warnId}** has been pardoned and will no longer count toward the threshold.`]))
  }
}
