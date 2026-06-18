'use strict'

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js')
const { error } = require('../../../shared/embed')
const { parseDuration, relativeTime } = require('../../../shared/utils')

// In-memory poll store: Map<messageId, pollData>
// For persistence across restarts, poll data is encoded in the embed footer
const POLL_EMOJI = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(256))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName('option5').setDescription('Option 5').setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName('duration').setDescription('Poll duration e.g. 1h, 1d (optional)').setRequired(false))
    .addBooleanOption(o => o.setName('anonymous').setDescription('Hide vote counts until poll ends').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: current)').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const question = interaction.options.getString('question')
    const durStr   = interaction.options.getString('duration')
    const anon     = interaction.options.getBoolean('anonymous') ?? false
    const channel  = interaction.options.getChannel('channel') ?? interaction.channel

    const options = []
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`option${i}`)
      if (opt) options.push(opt)
    }

    if (options.length < 2) {
      return interaction.editReply({ embeds: [error('Invalid', 'Provide at least 2 options.')] })
    }

    let endsAt = null
    if (durStr) {
      const secs = parseDuration(durStr)
      if (!secs) return interaction.editReply({ embeds: [error('Invalid duration', 'Use e.g. `1h`, `1d`.')] })
      endsAt = Math.floor(Date.now() / 1000) + secs
    }

    // votes[i] = Set of userIds
    const votes = options.map(() => [])

    const embed = buildPollEmbed(question, options, votes, anon, endsAt, interaction.user)

    // Buttons — one per option
    const rows = []
    const buttons = options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`poll_vote:${i}`)
        .setLabel(`${POLL_EMOJI[i]} ${opt.slice(0, 40)}`)
        .setStyle(ButtonStyle.Primary)
    )

    if (buttons.length <= 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons))
    } else {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(0, 5)))
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(5)))
    }

    // End poll button (mod only)
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_end')
        .setLabel('End Poll')
        .setStyle(ButtonStyle.Danger)
    ))

    let msg
    try { msg = await channel.send({ embeds: [embed], components: rows }) }
    catch (e) { return interaction.editReply({ embeds: [error('Failed', e.message)] }) }

    // Store poll in client map
    if (!client.polls) client.polls = new Map()
    client.polls.set(msg.id, {
      question, options,
      votes: options.map(() => new Set()),
      anon, endsAt,
      hostId: interaction.user.id,
      channelId: channel.id,
      messageId: msg.id,
      guildId: interaction.guild.id
    })

    // Schedule auto-end
    if (endsAt) {
      const ms = (endsAt - Math.floor(Date.now() / 1000)) * 1000
      setTimeout(() => endPoll(client, msg.id), ms)
    }

    await interaction.editReply({ content: `✅ Poll posted in ${channel}.` })
  }
}

function buildPollEmbed (question, options, votes, anon, endsAt, host) {
  const total = votes.reduce((a, v) => a + (v instanceof Set ? v.size : v.length), 0)

  const desc = options.map((opt, i) => {
    const count = votes[i] instanceof Set ? votes[i].size : votes[i].length
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0
    const bar   = buildBar(pct)
    return anon
      ? `${POLL_EMOJI[i]} **${opt}**`
      : `${POLL_EMOJI[i]} **${opt}**\n${bar} ${pct}% (${count} vote${count !== 1 ? 's' : ''})`
  }).join('\n\n')

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📊 ${question}`)
    .setDescription(desc)
    .setFooter({ text: `By ${host.tag} • Total votes: ${total}${anon ? ' • Anonymous' : ''}` })
    .setTimestamp()

  if (endsAt) embed.addFields({ name: 'Ends', value: relativeTime(endsAt), inline: true })

  return embed
}

function buildBar (pct, len = 12) {
  const filled = Math.round((pct / 100) * len)
  return '`' + '█'.repeat(filled) + '░'.repeat(len - filled) + '`'
}

async function endPoll (client, messageId) {
  const poll = client.polls?.get(messageId)
  if (!poll || poll.ended) return
  poll.ended = true

  const guild   = client.guilds.cache.get(poll.guildId)
  if (!guild) return
  const channel = guild.channels.cache.get(poll.channelId)
  if (!channel) return

  let msg
  try { msg = await channel.messages.fetch(messageId) } catch { return }

  const maxVotes = Math.max(...poll.votes.map(v => v.size))
  const winners  = poll.options.filter((_, i) => poll.votes[i].size === maxVotes)

  const embed = buildPollEmbed(poll.question, poll.options, poll.votes, false, null, await client.users.fetch(poll.hostId).catch(() => ({ tag: 'Unknown' })))
  embed.setTitle(`📊 [ENDED] ${poll.question}`)
  embed.setColor(0x57F287)
  if (winners.length) {
    embed.addFields({ name: '🏆 Winner', value: winners.join(', '), inline: true })
  }

  try {
    await msg.edit({ embeds: [embed], components: [] })
  } catch {}

  client.polls.delete(messageId)
}

module.exports.buildPollEmbed = buildPollEmbed
module.exports.endPoll = endPoll
