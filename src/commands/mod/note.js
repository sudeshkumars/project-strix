'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db             = require('../../../shared/db')
const { infoCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a hidden mod note to a user (not visible to the user)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('Note text').setRequired(true)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const text   = interaction.options.getString('text')
    const guild  = interaction.guild

    if (target.id === interaction.user.id) {
      return interaction.editReply(errorCard('Invalid', ['You cannot add a note to yourself.']))
    }

    const noteId = db.createNote(guild.id, target.id, interaction.user.id, text)

    const lines = [
      `**User** \u2014 ${target.tag} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.tag}`,
      `**Note** \u2014 ${text}`
    ]

    await interaction.editReply(infoCard(`\u{1f4dd} Note Added \u2014 #${noteId}`, lines, {
      thumbnail: target.displayAvatarURL({ size: 64 })
    }))
  }
}
