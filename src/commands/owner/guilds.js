'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { infoCard, successCard, errorCard } = require('../../../shared/components')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('guilds')
    .setDescription('View and manage bot guilds (owner only)')
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all guilds the bot is in')
      .addIntegerOption(o => o.setName('page').setDescription('Page').setMinValue(1).setRequired(false)))
    .addSubcommand(s => s
      .setName('info')
      .setDescription('Get info on a specific guild')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('leave')
      .setDescription('Leave a guild')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub = interaction.options.getSubcommand()

    if (sub === 'list') {
      const page    = (interaction.options.getInteger('page') ?? 1) - 1
      const limit   = 10
      const guilds  = [...client.guilds.cache.values()]
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(page * limit, page * limit + limit)

      if (!guilds.length) return interaction.editReply(infoCard('\u{1f310} Guilds', ['No guilds on this page.']))

      const lines = guilds.map(g =>
        `**${g.name}** \u2014 \`${g.id}\` | \u{1f465} ${g.memberCount} | Owner: \`${g.ownerId}\``
      )

      return interaction.editReply(infoCard(`\u{1f310} Guilds \u2014 Page ${page + 1}`, lines, {
        subtext: `Total: ${client.guilds.cache.size}`
      }))
    }

    if (sub === 'info') {
      const guildId = interaction.options.getString('guild_id')
      const guild   = client.guilds.cache.get(guildId)
      if (!guild) return interaction.editReply(errorCard('Not found', [`Not in guild \`${guildId}\`.`]))

      const lines = [
        `**ID** \u2014 ${guild.id}`,
        `**Members** \u2014 ${guild.memberCount}`,
        `**Owner** \u2014 \`${guild.ownerId}\``,
        `**Created** \u2014 <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
        `**Channels** \u2014 ${guild.channels.cache.size}`,
        `**Roles** \u2014 ${guild.roles.cache.size}`
      ]

      return interaction.editReply(infoCard(`\u{1f3e0} ${guild.name}`, lines, {
        thumbnail: guild.iconURL() || undefined
      }))
    }

    if (sub === 'leave') {
      const guildId = interaction.options.getString('guild_id')
      const guild   = client.guilds.cache.get(guildId)
      if (!guild) return interaction.editReply(errorCard('Not found', [`Not in guild \`${guildId}\`.`]))

      const name = guild.name
      try { await guild.leave() } catch (e) { return interaction.editReply(errorCard('Failed', [e.message])) }

      return interaction.editReply(successCard('Left Guild', [`Left **${name}** (\`${guildId}\`).`]))
    }
  }
}
