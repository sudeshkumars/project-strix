'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage bot blacklists (owner only)')
    .addSubcommand(s => s
      .setName('adduser')
      .setDescription('Blacklist a user')
      .addStringOption(o => o.setName('user_id').setDescription('User ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s
      .setName('removeuser')
      .setDescription('Remove user from blacklist')
      .addStringOption(o => o.setName('user_id').setDescription('User ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('addguild')
      .setDescription('Blacklist a guild')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s
      .setName('removeguild')
      .setDescription('Remove guild from blacklist')
      .addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all blacklisted users and guilds')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub = interaction.options.getSubcommand()

    if (sub === 'adduser') {
      const userId = interaction.options.getString('user_id')
      const reason = interaction.options.getString('reason') ?? 'No reason'
      db.blacklistUser(userId, reason)
      return interaction.editReply({ embeds: [success('User Blacklisted', `User \`${userId}\` blacklisted.`)] })
    }

    if (sub === 'removeuser') {
      const userId = interaction.options.getString('user_id')
      db.unblacklistUser(userId)
      return interaction.editReply({ embeds: [success('Removed', `User \`${userId}\` removed from blacklist.`)] })
    }

    if (sub === 'addguild') {
      const guildId = interaction.options.getString('guild_id')
      const reason  = interaction.options.getString('reason') ?? 'No reason'
      db.blacklistGuild(guildId, reason)

      // Leave the guild if currently in it
      const guild = client.guilds.cache.get(guildId)
      if (guild) await guild.leave().catch(() => {})

      return interaction.editReply({ embeds: [success('Guild Blacklisted', `Guild \`${guildId}\` blacklisted${guild ? ' and left' : ''}.`)] })
    }

    if (sub === 'removeguild') {
      const guildId = interaction.options.getString('guild_id')
      db.unblacklistGuild(guildId)
      return interaction.editReply({ embeds: [success('Removed', `Guild \`${guildId}\` removed from blacklist.`)] })
    }

    if (sub === 'list') {
      const users  = db.getBlacklistedUsers()
      const guilds = db.getBlacklistedGuilds()

      const embed = info('🚫 Blacklists', null)
        .addFields(
          { name: `Users (${users.length})`,  value: users.length  ? users.slice(0, 10).map(u => `\`${u.user_id}\` — ${u.reason}`).join('\n')  : 'None', inline: false },
          { name: `Guilds (${guilds.length})`, value: guilds.length ? guilds.slice(0, 10).map(g => `\`${g.guild_id}\` — ${g.reason}`).join('\n') : 'None', inline: false }
        )
      return interaction.editReply({ embeds: [embed] })
    }
  }
}
