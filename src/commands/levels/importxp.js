'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                      = require('../../../shared/db')
const { success, error, warn, info } = require('../../../shared/embed')
const { calcLevel, sleep }    = require('../../../shared/utils')

// MEE6 public leaderboard API — no auth required
const MEE6_API = 'https://mee6.xyz/api/plugins/levels/leaderboard'
const PAGE_LIMIT = 1000  // max users per import run

module.exports = {
  permLevel: 'admin',
  guildOnly: true,
  cooldown: 60,

  data: new SlashCommandBuilder()
    .setName('importxp')
    .setDescription('Import XP from MEE6 leaderboard into Stryx')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o =>
      o.setName('overwrite')
        .setDescription('Overwrite existing XP? (default: false — only imports users with 0 XP in Stryx)')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('limit')
        .setDescription(`Max users to import (default: 100, max: ${PAGE_LIMIT})`)
        .setMinValue(1)
        .setMaxValue(PAGE_LIMIT)
        .setRequired(false)
    ),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const overwrite = interaction.options.getBoolean('overwrite') ?? false
    const limit     = interaction.options.getInteger('limit') ?? 100
    const guildId   = interaction.guild.id

    // ── Fetch MEE6 leaderboard ────────────────────────────────────────────────
    await interaction.editReply({
      embeds: [info('⏳ Fetching MEE6 data...', `Requesting leaderboard for this server. This may take a moment.`)]
    })

    let players = []
    try {
      players = await fetchMee6Leaderboard(guildId, limit)
    } catch (e) {
      return interaction.editReply({
        embeds: [error('Fetch Failed', `Could not retrieve MEE6 data: ${e.message}\n\nMake sure the server's MEE6 leaderboard is **public**.`)]
      })
    }

    if (!players.length) {
      return interaction.editReply({
        embeds: [warn('No Data', 'MEE6 returned no leaderboard entries. Make sure the leaderboard is set to public in MEE6 dashboard.')]
      })
    }

    // ── Import ────────────────────────────────────────────────────────────────
    let imported  = 0
    let skipped   = 0
    let errors    = 0

    for (const player of players) {
      try {
        const userId = player.id
        if (!userId) { errors++; continue }

        // Convert MEE6 XP to Stryx XP
        // MEE6 stores message_count and detailed_xp; xp field = total XP
        const mee6Xp = player.xp ?? mee6LevelToXp(player.level ?? 0)

        if (!overwrite) {
          // Only import if user has no XP in Stryx
          const existing = db.getUser(userId, guildId)
          if (existing && existing.xp > 0) { skipped++; continue }
        }

        db.upsertUser(userId, guildId)
        db.setXp(userId, guildId, mee6Xp)
        const { level } = calcLevel(mee6Xp)
        db.setLevel(userId, guildId, level)

        imported++
      } catch {
        errors++
      }

      // Avoid hammering the DB
      if (imported % 50 === 0) await sleep(10)
    }

    // ── Result ────────────────────────────────────────────────────────────────
    const lines = [
      `✅ **Imported:** ${imported} users`,
      skipped ? `⏭️ **Skipped** (already have XP): ${skipped}` : null,
      errors  ? `❌ **Errors:** ${errors}` : null,
      ``,
      overwrite
        ? '⚠️ Existing XP was **overwritten**.'
        : '💡 Users with existing Stryx XP were skipped. Use `overwrite: True` to replace them.'
    ].filter(Boolean).join('\n')

    await interaction.editReply({
      embeds: [success(`MEE6 Import Complete`, lines)]
    })
  }
}

// ─── MEE6 API helpers ─────────────────────────────────────────────────────────

/**
 * Fetch all players up to `limit` from MEE6's paginated leaderboard API.
 * @param {string} guildId
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function fetchMee6Leaderboard (guildId, limit) {
  const players = []
  const pageSize = 100  // MEE6 returns max 100 per page
  let   page     = 0

  while (players.length < limit) {
    const url = `${MEE6_API}/${guildId}?page=${page}&limit=${pageSize}`

    const res = await fetch(url, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Stryx-Bot/1.0 XP-Import'
      },
      signal: AbortSignal.timeout(10_000)
    })

    if (res.status === 404) {
      throw new Error('Server not found on MEE6 or leaderboard is private.')
    }
    if (res.status === 403) {
      throw new Error('MEE6 leaderboard is set to private. Make it public in the MEE6 dashboard.')
    }
    if (!res.ok) {
      throw new Error(`MEE6 API returned HTTP ${res.status}.`)
    }

    const data = await res.json()
    const batch = data?.players ?? []

    if (!batch.length) break  // no more pages

    players.push(...batch)
    page++

    // Rate limit courtesy delay
    if (batch.length === pageSize && players.length < limit) {
      await sleep(300)
    } else {
      break
    }
  }

  return players.slice(0, limit)
}

/**
 * Approximate XP from MEE6 level if detailed XP is unavailable.
 * MEE6 formula: XP to reach level n = 5n² + 50n + 100 (same as Stryx).
 * @param {number} level
 * @returns {number}
 */
function mee6LevelToXp (level) {
  let total = 0
  for (let i = 0; i < level; i++) {
    total += 5 * i * i + 50 * i + 100
  }
  return total
}
