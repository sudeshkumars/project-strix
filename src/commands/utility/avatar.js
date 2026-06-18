'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { COLORS } = require('../../../shared/embed')

module.exports = {
  permLevel: 'user',
  guildOnly: false,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get a user\'s avatar')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const target = interaction.options.getUser('user') ?? interaction.user

    let member
    try { member = interaction.guild ? await interaction.guild.members.fetch(target.id) : null } catch {}

    const globalUrl = target.displayAvatarURL({ size: 1024, extension: 'png' })
    const serverUrl = member?.avatarURL({ size: 1024, extension: 'png' }) ?? null

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`🖼️ ${target.tag}'s Avatar`)
      .setImage(serverUrl ?? globalUrl)

    const links = [`[PNG](${globalUrl.replace('png', 'png')})`, `[WebP](${globalUrl.replace('png', 'webp')})`]
    if (target.displayAvatarURL().includes('a_')) links.push(`[GIF](${globalUrl.replace('png', 'gif')})`)

    embed.setDescription(links.join(' • '))

    if (serverUrl && serverUrl !== globalUrl) {
      embed.setFooter({ text: 'Showing server avatar. Global avatar linked below.' })
        .addFields({ name: 'Global Avatar', value: `[Click here](${globalUrl})`, inline: true })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
