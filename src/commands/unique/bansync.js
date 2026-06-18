'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { safeSend }             = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('bansync')
    .setDescription('Cross-guild ban synchronisation')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addSubcommand(s => s
      .setName('trust')
      .setDescription('Trust a guild — their bans will sync to you')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID to trust').setRequired(true)))
    .addSubcommand(s => s
      .setName('untrust')
      .setDescription('Remove a trusted guild')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List trusted guilds'))
    .addSubcommand(s => s
      .setName('push')
      .setDescription('Push a ban to all subscribed guilds')
      .addStringOption(o => o.setName('user_id').setDescription('User ID to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'trust') {
      const trustedId = interaction.options.getString('guild_id')
      if (trustedId === guildId) return interaction.editReply({ embeds: [error('Invalid', 'Cannot trust your own guild.')] })

      db.addBansyncGuild(guildId, trustedId)
      return interaction.editReply({ embeds: [success('Guild Trusted', `Guild \`${trustedId}\` bans will now sync to this server.`)] })
    }

    if (sub === 'untrust') {
      const trustedId = interaction.options.getString('guild_id')
      db.removeBansyncGuild(guildId, trustedId)
      return interaction.editReply({ embeds: [success('Removed', `Guild \`${trustedId}\` removed from trusted list.`)] })
    }

    if (sub === 'list') {
      const trusted = db.getBansyncGuilds(guildId)
      if (!trusted.length) return interaction.editReply({ content: 'No trusted guilds configured.' })

      const embed = info('🔗 Bansync Trusted Guilds', null)
      for (const t of trusted) {
        const g = client.guilds.cache.get(t.trusted_guild_id)
        embed.addFields({
          name:  g ? g.name : 'Unknown Guild',
          value: `\`${t.trusted_guild_id}\``,
          inline: true
        })
      }
      return interaction.editReply({ embeds: [embed] })
    }

    if (sub === 'push') {
      const userId = interaction.options.getString('user_id')
      const reason = interaction.options.getString('reason') ?? '[Bansync] No reason provided'

      // Validate user exists
      let target
      try { target = await client.users.fetch(userId) }
      catch { return interaction.editReply({ embeds: [error('Invalid', 'User not found.')] }) }

      // Get all guilds subscribed to this guild
      const subscribers = db.getBansyncSubscribers(guildId)
      if (!subscribers.length) return interaction.editReply({ embeds: [error('No subscribers', 'No guilds are syncing bans from this server.')] })

      let synced = 0, failed = 0
      for (const sub of subscribers) {
        const g = client.guilds.cache.get(sub.guild_id)
        if (!g) continue
        try {
          await g.members.ban(userId, { reason: `[Bansync from ${interaction.guild.name}] ${reason}` })
          db.createCase(sub.guild_id, userId, client.user.id, 'ban', `[Bansync] ${reason}`)
          synced++
        } catch { failed++ }
      }

      // Also ban in current guild
      try {
        await interaction.guild.members.ban(userId, { reason })
        db.createCase(guildId, userId, interaction.user.id, 'ban', reason)
      } catch {}

      return interaction.editReply({
        embeds: [success('Ban Pushed', `Banned ${target.tag} across **${synced}** guild(s).${failed ? ` Failed: ${failed}.` : ''}`)]
      })
    }
  }
}
