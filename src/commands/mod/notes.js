'use strict'

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js')
const db             = require('../../../shared/db')
const { COLORS }     = require('../../../shared/embed')
const { fullTime, truncate } = require('../../../shared/utils')

const PAGE_SIZE = 5

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('View all mod notes for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const page   = interaction.options.getInteger('page') ?? 1
    const guild  = interaction.guild

    const notes = db.getNotes(guild.id, target.id)

    if (!notes.length) {
      return interaction.editReply({ content: `📝 No notes found for **${target.tag}**.` })
    }

    const totalPages = Math.ceil(notes.length / PAGE_SIZE)
    const safePage   = Math.min(page, totalPages)
    const slice      = notes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`📝 Mod Notes — ${target.tag}`)
      .setDescription(`**${notes.length}** note${notes.length !== 1 ? 's' : ''} total`)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .setFooter({ text: `Page ${safePage}/${totalPages}` })
      .setTimestamp()

    for (const n of slice) {
      let modTag = `<@${n.mod_id}>`
      try {
        const modUser = await client.users.fetch(n.mod_id)
        modTag = modUser.tag
      } catch {}

      embed.addFields({
        name:  `Note #${n.id} — ${fullTime(n.created_at)} by ${modTag}`,
        value: truncate(n.note, 512),
        inline: false
      })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
