import { Coffee, Flag, Fuel, Moon, Package, RotateCw, Truck } from 'lucide-react'

export const EVENT_TYPES = {
  DRIVE: { label: 'Driving', color: 'var(--status-driving)', icon: Truck },
  PICKUP: { label: 'Pickup', color: 'var(--accent)', icon: Package, pin: 'B' },
  DROPOFF: { label: 'Drop-off', color: 'var(--ok)', icon: Flag, pin: 'C' },
  FUEL: { label: 'Fuel stop', color: 'var(--status-on-duty)', icon: Fuel },
  BREAK: { label: '30-minute break', color: 'var(--status-off-duty)', icon: Coffee },
  REST: { label: '10-hour rest', color: 'var(--status-sleeper)', icon: Moon },
  RESTART: { label: '34-hour restart', color: 'var(--event-restart)', icon: RotateCw },
}

export const START_MARKER = { label: 'Start', color: 'var(--ink)', pin: 'A' }

export const MARKER_TYPES = ['PICKUP', 'DROPOFF', 'FUEL', 'BREAK', 'REST', 'RESTART']

export function ruleLabel(rule) {
  if (!rule) return null
  return rule === 'assessment' ? 'Assessment assumption' : `49 CFR ${rule}`
}
