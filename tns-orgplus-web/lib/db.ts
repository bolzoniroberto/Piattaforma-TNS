import { initDb, getDb } from './db/init'
import type Database from 'better-sqlite3'

// Auto-initialize on first import (server-side only)
let initialized = false

export function db(): Database.Database {
  if (!initialized) {
    initDb()
    initialized = true
  }
  return getDb()
}

export function writeChangeLog(
  entityType: string,
  entityId: string,
  entityLabel: string | null,
  action: string,
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null
): void {
  db().prepare(`
    INSERT INTO change_log (entity_type, entity_id, entity_label, action, field_name, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, entityLabel, action, fieldName, oldValue, newValue)
}

export function suggestCodice(codicePadre: string, fratelli: string[]): string {
  if (fratelli.length === 0) return codicePadre + '01'

  if (fratelli.every((c) => /^[A-Z]$/.test(c))) {
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i)
      if (!fratelli.includes(letter)) return letter
    }
    return codicePadre + '_' + (fratelli.length + 1)
  }

  const letterNum = /^([A-Z]+)(\d+)$/
  const matches = fratelli.filter((c) => letterNum.test(c))
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1].match(letterNum)!
    const prefix = lastMatch[1]
    const maxNum = Math.max(...matches.map((c) => parseInt(c.match(letterNum)![2])))
    const nextNum = String(maxNum + 1).padStart(lastMatch[2].length, '0')
    return prefix + nextNum
  }

  return codicePadre + '_' + (fratelli.length + 1)
}
