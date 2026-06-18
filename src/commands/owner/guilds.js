'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { info, success, error } = require('../../../shared/embed')

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

      if (!guilds.length) return interaction.editReply({ content: 'No guilds on this page.' })

      const embed = info(`🌐 Guilds — Page ${page + 1}`, null)
        .setFooter({ text: `Total: ${client.guilds.cache.size}` })

      for (const g of guilds) {
        embed.addFields({
          name:  g.name,
          value: `\`${g.id}\` | 👥 ${g.memberCount} | Owner: \`${g.ownerId}\``,
          inline: false
        })
      }

      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'info') {
      const guildId = interaction.options.getString('guild_id')
      const guild   = client.guilds.cache.get(guildId)
      if (!guild) return interaction.editReply({ embeds: [error('Not found', `Not in guild \`${guildId}\`.`)] })

      const embed = info(`🏠 ${guild.name}`, null)
        .addFields(
          { name: 'ID',         value: guild.id,              inline: true },
          { name: 'Members',    value: String(guild.memberCount), inline: true },
          { name: 'Owner',      value: `\`${guild.ownerId}\``, inline: true },
          { name: 'Created',    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Channels',   value: String(guild.channels.cache.size), inline: true },
          { name: 'Roles',      value: String(guild.roles.cache.size), inline: true }
        )

      if (guild.iconURL()) embed.setThumbnail(guild.iconURL())
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'leave') {
      const guildId = interaction.options.getString('guild_id')
      const guild   = client.guilds.cache.get(guildId)
      if (!guild) return interaction.editReply({ embeds: [error('Not found', `Not in guild \`${guildId}\`.`)] })

      const name = guild.name
      try { await guild.leave() } catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }

      return interaction.editReply({ embeds: [success('Left Guild', `Left **${name}** (\`${guildId}\`).`)] })
    }
  }
}
