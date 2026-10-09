
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GRID_RIGHT, minuteToX, rowCenterY } from '../../lib/logGeometry'
import example from './__fixtures__/fmcsaExample.json'
import LogSheet from './LogSheet'

const details = { driver: 'John E. Doe', carrier: "John Doe's Transportation", office: 'Washington, D.C.', terminal: '', vehicles: '123, 20544', manifest: '101601', shipper: '' }
const svg = renderToStaticMarkup(<LogSheet log={example} details={details} />)
const text = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")

describe('the drawn sheet for the guide example', () => {
  it('shows the date as month / day / year', () => {
    expect(text).toMatch(/04\s*\(month\)/)
    expect(text).toMatch(/09\s*\(day\)/)
    expect(text).toMatch(/2021\s*\(year\)/)
  })

  it('shows the total miles driving today', () => {
    expect(text).toContain('350')
  })

  it('shows the hours for each duty status as the guide prints them, adding to 24', () => {
    expect(text).toContain('10:00') // off duty
    expect(text).toContain('1:45') // sleeper berth = 1.75 h
    expect(text).toContain('7:45') // driving = 7.75 h
    expect(text).toContain('4:30') // on duty (not driving) = 4.5 h
    expect(text).toContain('= 24:00')
  })

  it('fills in the carrier, vehicle, office, shipping number and driver name', () => {
    for (const value of ["John Doe's Transportation", '123, 20544', 'Washington, D.C.', '101601', 'John E. Doe']) {
      expect(text).toContain(value)
    }
  })

  it('names every place from the guide in the remarks', () => {
    for (const place of ['Richmond, VA', 'Fredericksburg, VA', 'Baltimore, MD', 'Philadelphia, PA', 'Cherry Hill, NJ', 'Newark, NJ']) {
      expect(text).toContain(place)
    }
  })

  it('draws the five driving stretches on the Driving row at the right times', () => {
    const driving = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="[\d.]+" data-status="DRIVING"/g)]
    const drawn = driving.map(([, x1, y, x2]) => [Number(x1), Number(y), Number(x2)])
    const expected = [
      [7 * 60 + 30, 9 * 60],
      [9 * 60 + 30, 12 * 60],
      [13 * 60, 15 * 60],
      [15 * 60 + 30, 16 * 60],
      [17 * 60 + 45, 19 * 60],
    ].map(([from, to]) => [minuteToX(from), rowCenterY('DRIVING'), minuteToX(to)])
    expect(drawn).toEqual(expected)
  })

  it('draws the day from midnight to midnight with the duty line reaching the right edge', () => {
    const lines = [...svg.matchAll(/data-status="(\w+)"/g)].map((m) => m[1])
    expect(lines[0]).toBe('OFF_DUTY')
    expect(lines.at(-1)).toBe('OFF_DUTY')
    expect(svg).toContain(`x2="${GRID_RIGHT}"`)
  })

  it('has an accessible description', () => {
    expect(svg).toContain('aria-label="Driver&#x27;s daily log for')
  })
})


describe('the planned line', () => {
  const planned = example.segments
  const edited = { ...example, segments: example.segments.map((s) => (s.start_minute === 450 ? { ...s, start_minute: 480 } : s.end_minute === 450 ? { ...s, end_minute: 480 } : s)) }

  it('is drawn as a dashed ghost under the actual line when a plan is given', () => {
    const html = renderToStaticMarkup(<LogSheet log={edited} details={details} plannedSegments={planned} />)
    expect(html).toContain('data-testid="planned-line"')
    expect(html).toContain('class="planned-ghost"')
    expect(html).toContain('stroke-dasharray="6 4"')
  })

  it('is absent for a day that matches the plan', () => {
    expect(renderToStaticMarkup(<LogSheet log={example} details={details} />)).not.toContain('planned-line')
  })

  it('has the same number of strokes as the plan has segments', () => {
    const html = renderToStaticMarkup(<LogSheet log={edited} details={details} plannedSegments={planned} />)
    const ghost = html.slice(html.indexOf('data-testid="planned-line"'), html.indexOf('data-testid="duty-line"'))
    expect(ghost.split('<line').length - 1).toBeGreaterThanOrEqual(planned.length)
  })
})
