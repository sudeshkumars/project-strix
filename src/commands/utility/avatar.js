'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard } = require('../../../shared/components')

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

    const links = [`[PNG](${globalUrl.replace('png', 'png')})`, `[WebP](${globalUrl.replace('png', 'webp')})`]
    if (target.displayAvatarURL().includes('a_')) links.push(`[GIF](${globalUrl.replace('png', 'gif')})`)

    const lines = [links.join(' \u2022 ')]

    if (serverUrl && serverUrl !== globalUrl) {
      lines.push(`**Global Avatar** \u2014 [Click here](${globalUrl})`)
      lines.push('*Showing server avatar below.*')
    }

    await interaction.editReply(infoCard(`\u{1f5bc}\ufe0f ${target.tag}'s Avatar`, lines, {
      image: serverUrl ?? globalUrl
    }))
  }
}
