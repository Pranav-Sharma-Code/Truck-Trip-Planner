export const STATUS_ORDER = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING']

export const STATUS_LABELS = {
  OFF_DUTY: 'Off Duty',
  SLEEPER_BERTH: 'Sleeper Berth',
  DRIVING: 'Driving',
  ON_DUTY_NOT_DRIVING: 'On Duty (not driving)',
}

const STATUS_COLORS = {
  OFF_DUTY: 'var(--status-off-duty)',
  SLEEPER_BERTH: 'var(--status-sleeper)',
  DRIVING: 'var(--status-driving)',
  ON_DUTY_NOT_DRIVING: 'var(--status-on-duty)',
}

export function statusColor(status) {
  return STATUS_COLORS[status]
}
