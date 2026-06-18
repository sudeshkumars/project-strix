'use strict'

const { MessageFlags }  = require('discord.js')
const { runMiddleware } = require('../middleware/pipeline')
const { getConfig }     = require('../../shared/cache')
const logger            = require('../../shared/logger')
const db                = require('../../shared/db')

/**
 * Resolve a handler from a Map<string|RegExp, handler> by customId string.
 * Tries exact match first, then regex match, then prefix match (legacy).
 */
function resolveHandler (map, customId) {
  // 1. Exact match
  if (map.has(customId)) return map.get(customId)

  // 2. Regex match
  for (const [key, handler] of map) {
    if (key instanceof RegExp && key.test(customId)) return handler
  }

  // 3. Legacy prefix match — "ticket_close:123" → try "ticket_close"
  const baseId = customId.split(':')[0]
  if (map.has(baseId)) return map.get(baseId)

  return null
}

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute (client, interaction) {
    const config = interaction.guild
      ? getConfig(client, interaction.guild.id)
      : null

    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName)
      if (!command) return

      interaction._extra = { type: 'slash', config }
      const blocked = await runMiddleware(client, interaction, command, interaction._extra)
      if (blocked) return

      try {
        await command.execute(client, interaction, null)
        logger.command(interaction.commandName, interaction.user.id, interaction.guild?.id)
        db.incrementBotStat('commands_fired')
      } catch (e) {
        logger.error(`Slash cmd ${interaction.commandName} error:`, e)
        const payload = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }
        interaction.replied || interaction.deferred
          ? interaction.followUp(payload).catch(() => {})
          : interaction.reply(payload).catch(() => {})
      }
      return
    }

    // ── Autocomplete ──────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName)
      if (!command?.autocomplete) return
      try {
        await command.autocomplete(client, interaction)
      } catch (e) {
        logger.error(`Autocomplete ${interaction.commandName} error:`, e)
      }
      return
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const handler = resolveHandler(client.buttons, interaction.customId)
      if (!handler) return
      try {
        await handler.execute(client, interaction, config)
      } catch (e) {
        logger.error(`Button ${interaction.customId} error:`, e)
        const payload = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }
        interaction.replied || interaction.deferred
          ? interaction.followUp(payload).catch(() => {})
          : interaction.reply(payload).catch(() => {})
      }
      return
    }

    // ── Modals ────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const handler = resolveHandler(client.modals, interaction.customId)
      if (!handler) return
      try {
        await handler.execute(client, interaction, config)
      } catch (e) {
        logger.error(`Modal ${interaction.customId} error:`, e)
        const payload = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }
        interaction.replied || interaction.deferred
          ? interaction.followUp(payload).catch(() => {})
          : interaction.reply(payload).catch(() => {})
      }
      return
    }

    // ── Select menus ──────────────────────────────────────────────────────────
    if (interaction.isAnySelectMenu()) {
      const handler = resolveHandler(client.menus, interaction.customId)
      if (!handler) return
      try {
        await handler.execute(client, interaction, config)
      } catch (e) {
        logger.error(`Menu ${interaction.customId} error:`, e)
        const payload = { content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }
        interaction.replied || interaction.deferred
          ? interaction.followUp(payload).catch(() => {})
          : interaction.reply(payload).catch(() => {})
      }
      return
    }
  }
}
