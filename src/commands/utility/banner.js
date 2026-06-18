'use strict'

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { COLORS, error } = require('../../../shared/embed')

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

      // Must fetch to get banner
      const fetched = await client.users.fetch(target.id, { force: true }).catch(() => null)
      if (!fetched) return interaction.editReply({ embeds: [error('Failed', 'Could not fetch user.')] })

      const bannerUrl = fetched.bannerURL({ size: 1024, extension: 'png' })
        ?? fetched.bannerURL({ size: 1024 })

      if (!bannerUrl) {
        // Show accent color instead
        const hex = fetched.accentColor?.toString(16).padStart(6, '0') ?? '5865F2'
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(parseInt(hex, 16))
            .setTitle(`🎨 ${fetched.tag}'s Profile`)
            .setDescription(`No banner set.\n**Accent color:** \`#${hex}\``)
          ]
        })
      }

      const isGif = bannerUrl.includes('a_')
      const links = [
        `[PNG](${bannerUrl.replace(/\.(png|gif|webp)/, '.png')})`,
        `[WebP](${bannerUrl.replace(/\.(png|gif|webp)/, '.webp')})`,
        isGif ? `[GIF](${bannerUrl.replace(/\.(png|gif|webp)/, '.gif')})` : null
      ].filter(Boolean).join(' • ')

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`🖼️ ${fetched.tag}'s Banner`)
        .setImage(isGif ? bannerUrl.replace('.png', '.gif') : bannerUrl)
        .setDescription(links)

      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'server') {
      if (!interaction.guild) {
        return interaction.editReply({ embeds: [error('No guild', 'This subcommand only works in a server.')] })
      }

      const guild      = await interaction.guild.fetch()
      const bannerUrl  = guild.bannerURL({ size: 1024, extension: 'png' })
      const splashUrl  = guild.splashURL({ size: 1024 })
      const discoverUrl = guild.discoverySplashURL?.({ size: 1024 })

      if (!bannerUrl && !splashUrl) {
        return interaction.editReply({ content: `**${guild.name}** has no banner or splash set.` })
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`🖼️ ${guild.name}`)

      if (bannerUrl) {
        embed.setImage(bannerUrl)
        embed.addFields({ name: 'Banner', value: `[View](${bannerUrl})`, inline: true })
      }
      if (splashUrl) {
        embed.addFields({ name: 'Invite Splash', value: `[View](${splashUrl})`, inline: true })
      }
      if (discoverUrl) {
        embed.addFields({ name: 'Discovery Splash', value: `[View](${discoverUrl})`, inline: true })
      }

      return interaction.editReply({ embeds: [embed] })
    }
  }
}
