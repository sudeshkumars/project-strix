'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard, errorCard, buildCardPayload } = require('../../../shared/components')

module.exports = {
  permLevel: 'user',
  guildOnly: false,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Get a user\'s or server\'s banner')
    .addSubcommand(s => s
      .setName('user')
      .setDescription('Get a user\'s profile banner')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s
      .setName('server')
      .setDescription('Get this server\'s banner')),

  async execute (client, interaction) {
    await interaction.deferReply()

    const sub = interaction.options.getSubcommand()

    if (sub === 'user') {
      const target = interaction.options.getUser('user') ?? interaction.user

      const fetched = await client.users.fetch(target.id, { force: true }).catch(() => null)
      if (!fetched) return interaction.editReply(errorCard('Failed', ['Could not fetch user.']))

      const bannerUrl = fetched.bannerURL({ size: 1024, extension: 'png' })
        ?? fetched.bannerURL({ size: 1024 })

      if (!bannerUrl) {
        const hex = fetched.accentColor?.toString(16).padStart(6, '0') ?? '5865F2'
        return interaction.editReply(buildCardPayload({
          accent: parseInt(hex, 16),
          title: `\u{1f3a8} ${fetched.tag}'s Profile`,
          lines: [`No banner set.`, `**Accent color** \u2014 \`#${hex}\``]
        }))
      }

      const isGif = bannerUrl.includes('a_')
      const links = [
        `[PNG](${bannerUrl.replace(/\.(png|gif|webp)/, '.png')})`,
        `[WebP](${bannerUrl.replace(/\.(png|gif|webp)/, '.webp')})`,
        isGif ? `[GIF](${bannerUrl.replace(/\.(png|gif|webp)/, '.gif')})` : null
      ].filter(Boolean).join(' \u2022 ')

      return interaction.editReply(infoCard(`\u{1f5bc}\ufe0f ${fetched.tag}'s Banner`, [links], {
        image: isGif ? bannerUrl.replace('.png', '.gif') : bannerUrl
      }))
    }

    if (sub === 'server') {
      if (!interaction.guild) {
        return interaction.editReply(errorCard('No guild', ['This subcommand only works in a server.']))
      }

      const guild      = await interaction.guild.fetch()
      const bannerUrl  = guild.bannerURL({ size: 1024, extension: 'png' })
      const splashUrl  = guild.splashURL({ size: 1024 })
      const discoverUrl = guild.discoverySplashURL?.({ size: 1024 })

      if (!bannerUrl && !splashUrl) {
        return interaction.editReply(infoCard(`\u{1f5bc}\ufe0f ${guild.name}`, [`**${guild.name}** has no banner or splash set.`]))
      }

      const lines = []
      if (bannerUrl)   lines.push(`**Banner** \u2014 [View](${bannerUrl})`)
      if (splashUrl)   lines.push(`**Invite Splash** \u2014 [View](${splashUrl})`)
      if (discoverUrl) lines.push(`**Discovery Splash** \u2014 [View](${discoverUrl})`)

      return interaction.editReply(infoCard(`\u{1f5bc}\ufe0f ${guild.name}`, lines, {
        image: bannerUrl || undefined
      }))
    }
  }
}
