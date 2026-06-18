'use strict'

const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require('discord.js')
const db                       = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
const { parseDuration, formatDuration, relativeTime, safeSend } = require('../../../shared/utils')

module.exports = {
  permLevel: 'mod',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('start')
      .setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1d, 12h').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(false))
      .addRoleOption(o => o.setName('required_role').setDescription('Role required to enter').setRequired(false))
      .addRoleOption(o => o.setName('bonus_role').setDescription('Role that gets bonus entries').setRequired(false))
      .addIntegerOption(o => o.setName('bonus_entries').setDescription('Bonus entry count').setMinValue(2).setMaxValue(10).setRequired(false)))
    .addSubcommand(s => s
      .setName('end')
      .setDescription('End a giveaway early')
      .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('reroll')
      .setDescription('Reroll winners')
      .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'start') {
      const prize        = interaction.options.getString('prize')
      const durStr       = interaction.options.getString('duration')
      const channel      = interaction.options.getChannel('channel')
      const winners      = interaction.options.getInteger('winners') ?? 1
      const requiredRole = interaction.options.getRole('required_role')
      const bonusRole    = interaction.options.getRole('bonus_role')
      const bonusEntries = interaction.options.getInteger('bonus_entries') ?? 2

      const secs = parseDuration(durStr)
      if (!secs) return interaction.editReply({ embeds: [error('Invalid duration', 'Use e.g. `1d`, `12h`.')] })

      const endsAt = Math.floor(Date.now() / 1000) + secs

      const gwId = db.createGiveaway(
        guildId, channel.id, prize, winners, endsAt,
        requiredRole?.id ?? null, bonusRole?.id ?? null,
        bonusEntries, interaction.user.id
      )

      const embed = buildGiveawayEmbed(prize, winners, endsAt, interaction.user, requiredRole, bonusRole, bonusEntries)
      const row   = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter:${gwId}`)
          .setLabel('🎉 Enter')
          .setStyle(ButtonStyle.Success)
      )

      const msg = await safeSend(channel, { embeds: [embed], components: [row] })
      if (msg) db.updateGiveaway(gwId, { message_id: msg.id })

      return interaction.editReply({ embeds: [success('Giveaway Started', `Giveaway **#${gwId}** started in ${channel}!\nEnds: ${relativeTime(endsAt)}`)] })
    }

    if (sub === 'end') {
      const gwId = interaction.options.getInteger('id')
      const gw   = db.getGiveaway(gwId)
      if (!gw || gw.guild_id !== guildId) return interaction.editReply({ embeds: [error('Not found', `Giveaway #${gwId} not found.`)] })
      if (gw.ended) return interaction.editReply({ embeds: [error('Already ended', 'This giveaway has already ended.')] })

      await endGiveaway(client, gw)
      return interaction.editReply({ embeds: [success('Ended', `Giveaway **#${gwId}** ended.`)] })
    }

    if (sub === 'reroll') {
      const gwId = interaction.options.getInteger('id')
      const gw   = db.getGiveaway(gwId)
      if (!gw || gw.guild_id !== guildId) return interaction.editReply({ embeds: [error('Not found', `Giveaway #${gwId} not found.`)] })
      if (!gw.ended) return interaction.editReply({ embeds: [error('Not ended', 'End the giveaway first.')] })

      await endGiveaway(client, gw, true)
      return interaction.editReply({ embeds: [success('Rerolled', `Giveaway **#${gwId}** rerolled.`)] })
    }
  }
}

function buildGiveawayEmbed (prize, winners, endsAt, host, requiredRole, bonusRole, bonusEntries) {
  const e = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🎉 GIVEAWAY')
    .setDescription(`**Prize:** ${prize}`)
    .addFields(
      { name: 'Winners',  value: String(winners),         inline: true },
      { name: 'Ends',     value: relativeTime(endsAt),    inline: true },
      { name: 'Hosted by', value: `${host}`,              inline: true }
    )
    .setTimestamp(endsAt * 1000)

  if (requiredRole) e.addFields({ name: 'Required Role', value: `${requiredRole}`, inline: true })
  if (bonusRole)    e.addFields({ name: 'Bonus Role',    value: `${bonusRole} (+${bonusEntries - 1} entries)`, inline: true })

  return e
}

async function endGiveaway (client, gw, reroll = false) {
  db.updateGiveaway(gw.id, { ended: 1 })

  const guild   = client.guilds.cache.get(gw.guild_id)
  if (!guild) return

  const channel = guild.channels.cache.get(gw.channel_id)
  if (!channel) return

  // Fetch entrants from button reactions
  let msg
  try { msg = await channel.messages.fetch(gw.message_id) } catch { return }

  // Collect entrants from button interaction — stored via giveaway_enter button
  // For simplicity, fetch all members who reacted with 🎉 (fallback approach)
  const entrants = []

  // Build entry pool from members (button handler stores in a temp map)
  const pool = client.giveawayEntries?.get(gw.id) ?? new Map()

  for (const [userId, entries] of pool) {
    for (let i = 0; i < entries; i++) entrants.push(userId)
  }

  if (!entrants.length) {
    await safeSend(channel, { content: `🎉 Giveaway ended — **no valid entrants** for **${gw.prize}**.` })
    return
  }

  // Pick winners
  const winners = []
  const pool2   = [...entrants]
  for (let i = 0; i < Math.min(gw.winners, pool2.length); i++) {
    const idx = Math.floor(Math.random() * pool2.length)
    winners.push(pool2.splice(idx, 1)[0])
  }

  const winnerMentions = [...new Set(winners)].map(id => `<@${id}>`).join(', ')
  const label = reroll ? '🎉 Reroll Winners' : '🎉 Giveaway Ended'

  await safeSend(channel, {
    content: `${winnerMentions} — Congratulations! You won **${gw.prize}**!`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(label)
        .setDescription(`**Prize:** ${gw.prize}\n**Winners:** ${winnerMentions}`)
        .setTimestamp()
    ]
  })

  // Disable the enter button
  try {
    await msg.edit({ components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter:${gw.id}`)
          .setLabel('🎉 Giveaway Ended')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      )
    ]})
  } catch {}
}

module.exports.endGiveaway = endGiveaway
