'use strict'

const db     = require('../../shared/db')
const logger = require('../../shared/logger')
const { calcLevel } = require('../../shared/utils')

module.exports = {
  name:     'voiceXp',
  interval: '*/5 * * * *',   // every 5 minutes

  async execute (client) {
    for (const guild of client.guilds.cache.values()) {
      const config = client.guildCache.get(guild.id)
      if (!config) continue

      const blacklist = parseObj(config.xp_blacklist)

      for (const [, channel] of guild.channels.cache) {
        if (!channel.isVoiceBased()) continue
        if (blacklist.channels?.includes(channel.id)) continue

        const members = channel.members.filter(m =>
          !m.user.bot &&
          !m.deaf &&
          !m.selfDeaf
        )

        for (const [, member] of members) {
          const roles = member.roles.cache.map(r => r.id)
          if (blacklist.roles?.some(r => roles.includes(r))) continue

          const base   = config.xp_min ?? 15
          const max    = config.xp_max ?? 25
          let amount   = Math.floor(Math.random() * (max - base + 1)) + base

          // Multipliers
          const multipliers = db.getDb().prepare('SELECT * FROM xp_multipliers WHERE guild_id = ?').all(guild.id)
          let top = 1.0
          for (const m of multipliers) {
            if (roles.includes(m.role_id) && m.multiplier > top) top = m.multiplier
          }
          amount = Math.floor(amount * top)

          const row     = db.getUser(member.id, guild.id)
          const prevLv  = row?.level ?? 0
          const updated = db.addXp(member.id, guild.id, amount)
          db.addVoiceMinutes(member.id, guild.id, 5)

          // Assign voice roles based on total voice minutes
          const userRow = db.getUser(member.id, guild.id)
          const totalMinutes = userRow?.voice_minutes ?? 0
          const voiceRoles = db.getVoiceRoles(guild.id)
          for (const vr of voiceRoles.filter(r => r.minutes <= totalMinutes)) {
            if (!member.roles.cache.has(vr.role_id)) {
              try { await member.roles.add(vr.role_id, `Voice activity reward (${vr.minutes} min)`) } catch {}
            }
          }

          const { level } = calcLevel(updated.xp)
          if (level !== prevLv) {
            db.setLevel(member.id, guild.id, level)

            // Assign level roles
            const levelRoles = db.getLevelRoles(guild.id)
            for (const lr of levelRoles.filter(r => r.level <= level)) {
              if (!member.roles.cache.has(lr.role_id)) {
                try { await member.roles.add(lr.role_id, `Level ${level} reward`) } catch {}
              }
            }

            // Level-up message
            const lvCh = config.levelup_channel
              ? guild.channels.cache.get(config.levelup_channel)
              : null
            if (lvCh) {
              const msg = (config.levelup_message ?? 'GG {user}, you reached level {level}!')
                .replace(/{user}/g,   member.toString())
                .replace(/{level}/g,  String(level))
                .replace(/{server}/g, guild.name)
              lvCh.send({ content: msg }).catch(() => {})
            }
          }
        }
      }
    }
  }
}

function parseObj (val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}
