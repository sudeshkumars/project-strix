'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db             = require('../../../shared/db')
const { COLORS }     = require('../../../shared/embed')

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
      return interaction.editReply({ content: '❌ You cannot add a note to yourself.' })
    }

    const noteId = db.createNote(guild.id, target.id, interaction.user.id, text)

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`📝 Note Added — #${noteId}`)
      .addFields(
        { name: 'User',  value: `${target.tag} (\`${target.id}\`)`, inline: true },
        { name: 'Mod',   value: `${interaction.user.tag}`,           inline: true },
        { name: 'Note',  value: text,                                inline: false }
      )
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
}
