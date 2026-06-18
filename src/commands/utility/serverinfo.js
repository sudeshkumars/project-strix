'use strict'

const { SlashCommandBuilder, ChannelType } = require('discord.js')
const db              = require('../../../shared/db')
const { infoCard }    = require('../../../shared/components')
const { fullTime }    = require('../../../shared/utils')

const VERIFICATION = ['None', 'Low', 'Medium', 'High', 'Very High']

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View server information'),

  async execute (client, interaction) {
    await interaction.deferReply()

    const guild   = interaction.guild
    const guildId = guild.id

    await guild.fetch()

    const members  = guild.members.cache
    const bots     = members.filter(m => m.user.bot).size
    const humans   = guild.memberCount - bots
    const channels = guild.channels.cache
    const text     = channels.filter(c => c.type === ChannelType.GuildText).size
    const voice    = channels.filter(c => c.isVoiceBased()).size
    const cats     = channels.filter(c => c.type === ChannelType.GuildCategory).size
    const roles    = guild.roles.cache.size - 1
    const emojis   = guild.emojis.cache.size
    const boosts   = guild.premiumSubscriptionCount ?? 0
    const tier     = guild.premiumTier

    const stats    = db.getActivityStats(guildId, 7)
    const totalMsg = stats.reduce((a, b) => a + (b.messages ?? 0), 0)
    const totalJoin = stats.reduce((a, b) => a + (b.joins ?? 0), 0)

    const lines = [
      `**ID** \u2014 ${guild.id}`,
      `**Owner** \u2014 <@${guild.ownerId}>`,
      `**Created** \u2014 ${fullTime(Math.floor(guild.createdTimestamp / 1000))}`,
      `**Members** \u2014 \u{1f465} ${humans} humans | \u{1f916} ${bots} bots`,
      `**Channels** \u2014 \u{1f4ac} ${text} text | \u{1f50a} ${voice} voice | \u{1f4c1} ${cats} cats`,
      `**Roles** \u2014 ${roles}`,
      `**Emojis** \u2014 ${emojis}`,
      `**Boosts** \u2014 ${boosts} (Tier ${tier})`,
      `**Verification** \u2014 ${VERIFICATION[guild.verificationLevel] ?? 'Unknown'}`,
      `**7d Activity** \u2014 \u{1f4e8} ${totalMsg} msgs | \u{1f4e5} ${totalJoin} joins`
    ]

    if (guild.description) lines.unshift(guild.description)

    const features = guild.features.slice(0, 6).map(f => `\`${f}\``).join(', ')
    if (features) lines.push(`**Features** \u2014 ${features}`)

    await interaction.editReply(infoCard(`\u{1f3e0} ${guild.name}`, lines, {
      thumbnail: guild.iconURL({ size: 256 }) || undefined,
      image: guild.bannerURL({ size: 1024 }) || undefined
    }))
  }
}
