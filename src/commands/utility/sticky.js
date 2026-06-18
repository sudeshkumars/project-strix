'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                         = require('../../../shared/db')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set a sticky message in a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for the sticky').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Sticky message content').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription('Messages before re-post (default 5)').setMinValue(1).setMaxValue(100).setRequired(false))
      .addBooleanOption(o => o.setName('embed').setDescription('Send as embed (default false)').setRequired(false)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a sticky from a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to remove sticky from').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all stickies in this guild')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'set') {
      const channel   = interaction.options.getChannel('channel')
      const content   = interaction.options.getString('content')
      const threshold = interaction.options.getInteger('threshold') ?? 5
      const asEmbed   = interaction.options.getBoolean('embed') ?? false

      db.createSticky(guildId, channel.id, content, asEmbed ? 'true' : null, threshold, interaction.user.id)

      return interaction.editReply(successCard('Sticky Message Set', [
        `**Channel:** ${channel}`,
        `**Threshold:** ${threshold} messages`,
        `**Embed:** ${asEmbed ? 'Yes' : 'No'}`
      ]))
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel')
      const sticky  = db.getSticky(guildId, channel.id)

      if (!sticky) {
        return interaction.editReply(errorCard('Not Found', ['No sticky message in that channel.']))
      }

      // Try to delete the old sticky message
      try {
        const ch = interaction.guild.channels.cache.get(channel.id)
        if (ch && sticky.message_id) {
          const msg = await ch.messages.fetch(sticky.message_id).catch(() => null)
          if (msg) await msg.delete().catch(() => {})
        }
      } catch {}

      db.deleteSticky(guildId, channel.id)
      return interaction.editReply(successCard('Sticky Removed', [`Sticky message removed from ${channel}.`]))
    }

    if (sub === 'list') {
      const stickies = db.getAllStickies(guildId)
      if (!stickies.length) {
        return interaction.editReply(infoCard('Sticky Messages', ['No sticky messages configured.']))
      }

      const lines = capList(stickies, 15, s => {
        const status = s.enabled ? '\\u2705' : '\\u274c'
        return `${status} <#${s.channel_id}> - threshold: **${s.threshold}** - "${s.content?.slice(0, 40) || '(embed)'}"`
      })

      return interaction.editReply(infoCard('Sticky Messages', lines))
    }
  }
}
