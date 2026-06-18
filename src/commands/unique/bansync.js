'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                                           = require('../../../shared/db')
const { successCard, errorCard, infoCard }         = require('../../../shared/components')
const { safeSend }                                 = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('bansync')
    .setDescription('Cross-guild ban synchronisation')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addSubcommand(s => s
      .setName('trust')
      .setDescription('Trust a guild \u2014 their bans will sync to you')
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
      if (trustedId === guildId) return interaction.editReply(errorCard('Invalid', ['Cannot trust your own guild.']))

      db.addBansyncGuild(guildId, trustedId)
      return interaction.editReply(successCard('Guild Trusted', [`Guild \`${trustedId}\` bans will now sync to this server.`]))
    }

    if (sub === 'untrust') {
      const trustedId = interaction.options.getString('guild_id')
      db.removeBansyncGuild(guildId, trustedId)
      return interaction.editReply(successCard('Removed', [`Guild \`${trustedId}\` removed from trusted list.`]))
    }

    if (sub === 'list') {
      const trusted = db.getBansyncGuilds(guildId)
      if (!trusted.length) return interaction.editReply(infoCard('\u{1f517} Bansync Trusted Guilds', ['No trusted guilds configured.']))

      const lines = trusted.map(t => {
        const g = client.guilds.cache.get(t.trusted_guild_id)
        return `**${g ? g.name : 'Unknown Guild'}** \u2014 \`${t.trusted_guild_id}\``
      })
      return interaction.editReply(infoCard('\u{1f517} Bansync Trusted Guilds', lines))
    }

    if (sub === 'push') {
      const userId = interaction.options.getString('user_id')
      const reason = interaction.options.getString('reason') ?? '[Bansync] No reason provided'

      let target
      try { target = await client.users.fetch(userId) }
      catch { return interaction.editReply(errorCard('Invalid', ['User not found.'])) }

      const subscribers = db.getBansyncSubscribers(guildId)
      if (!subscribers.length) return interaction.editReply(errorCard('No subscribers', ['No guilds are syncing bans from this server.']))

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

      try {
        await interaction.guild.members.ban(userId, { reason })
        db.createCase(guildId, userId, interaction.user.id, 'ban', reason)
      } catch {}

      return interaction.editReply(successCard('Ban Pushed', [
        `Banned ${target.tag} across **${synced}** guild(s).${failed ? ` Failed: ${failed}.` : ''}`
      ]))
    }
  }
}
