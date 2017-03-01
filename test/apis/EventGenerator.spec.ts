import { describe, beforeEach, it } from 'tman'
import { expect } from 'chai'
import * as Moment from 'moment'
import {
  recurrenceByMonth,
  recurrenceHasEnd,
  normalEvent
} from '../fixtures/events.fixture'
import { EventGenerator } from '../../src/apis/event/EventGenerator'
import { clone } from '../index'

describe('EventGenerator spec', () => {
  let eventGenerator: EventGenerator
  beforeEach(() => {
    eventGenerator = new EventGenerator(recurrenceByMonth as any)
  })

  it('new operator should return instanceof EventGenerator', () => {
    expect(eventGenerator).to.be.instanceof(EventGenerator)
  })

  it('should get next event', () => {
    const nextEvent = eventGenerator.next()
    const expected = clone(recurrenceByMonth);
    ['_id', 'startDate', 'endDate']
      .forEach(f => {
        delete nextEvent.value[f]
        delete expected[f]
      })
    expect(nextEvent.value).to.deep.equal(expected)
  })

  it('next and next should return correct value', () => {
    eventGenerator.next()
    const nextEvent = eventGenerator.next()
    expect(nextEvent.value.startDate).to.deep.equal(Moment(recurrenceByMonth.startDate).add(1, 'month').toISOString())
    const nextEvent1 = eventGenerator.next()
    expect(nextEvent1.value.startDate).to.deep.equal(Moment(recurrenceByMonth.startDate).add(2, 'month').toISOString())
  })

  it('takeUntil an out range Date should return empty array', () => {
    const from = Moment(recurrenceByMonth.startDate).add(-10, 'year').toDate()
    const result = eventGenerator.takeUntil(from)
    expect(result).to.deep.equal([])
  })

  it('takeUntil should return correct value', () => {
    const start = new Date(recurrenceByMonth.startDate)
    const result = eventGenerator.takeUntil(Moment(start).add(11, 'month').toDate())
    expect(result.length).to.equal(11)
    result.forEach((r, index) => {
      expect(r.startDate).to.equal(Moment(start).add(index, 'month').toISOString())
    })
  })

  it('takeUntil hasEnd recurrence event should return correct result', () => {
    const _eventGenerator = new EventGenerator(recurrenceHasEnd as any)
    const result = _eventGenerator.takeUntil(Moment().add(1, 'day').startOf('day').toDate())
    expect(result.length).to.equal(100)
  })

  it('takeUntil a normal event should return single value array', () => {
    const _eventGenerator = new EventGenerator(normalEvent as any)
    const result = _eventGenerator.takeUntil(Moment().add(1, 'day').startOf('day').toDate())
    expect(result.length).to.equal(1)
    expect(result).to.deep.equal([normalEvent])
  })

  it('takeFrom an out range Date should return empty array', () => {
    const now = new Date
    const result = eventGenerator.takeFrom(Moment(now).add(-10, 'year').toDate(), Moment(now).add(-9, 'year').toDate())
    expect(result).to.deep.equal([])
  })

  it('takeFrom should return correct values', () => {
    const now = new Date
    const result = eventGenerator.takeFrom(now, Moment(now).add(10, 'month').toDate())
    const [ first ] = result
    expect(result.length).to.equal(10)
    result.forEach((r, index) => {
      expect(r.startDate).to.equal(Moment(first.startDate).add(index, 'month').toISOString())
      expect(r.endDate).to.equal(Moment(first.endDate).add(index, 'month').toISOString())
    })
  })

  it('takeFrom hasEnd recurrence event should return correct values', () => {
    const _eventGenerator = new EventGenerator(recurrenceHasEnd as any)
    const startDay = recurrenceHasEnd.startDate
    const result = _eventGenerator.takeFrom(Moment(startDay).subtract(1, 'day').toDate(), Moment().add(1, 'day').startOf('day').toDate())
    expect(result.length).to.equal(100)
  })

  it('takeFrom normal event should return single value array when date is in range', () => {
    const _eventGenerator = new EventGenerator(normalEvent as any)
    const startDay = Moment(normalEvent.startDate).startOf('day')
    const result = _eventGenerator.takeFrom(startDay.toDate(), startDay.clone().endOf('day').toDate())
    expect(result.length).to.equal(1)
    expect(result).to.deep.equal([normalEvent])
  })

  it('takeFrom normal event should return empty array when date is out of range', () => {
    const _eventGenerator = new EventGenerator(normalEvent as any)
    const startDay = Moment(normalEvent.startDate).add(1, 'day').startOf('day')
    const result = _eventGenerator.takeFrom(startDay.toDate(), startDay.clone().endOf('day').toDate())
    expect(result).to.deep.equal([])
  })
})
