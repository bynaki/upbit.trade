import test from 'ava'
import {
  UPbitSequence,
  getConfig,
  upbit_types as Iu,
} from '../src'


const api = new UPbitSequence(getConfig('./config.json').upbit_keys)


test('UPbitSequence#chunkTradesTicks()', async t => {
  const trs: Iu.TradeTickType[] = []
  for await (let res of api.chunkTradesTicks({
    market: 'KRW-BTC',
    daysAgo: 0,
    count: 10,
    to: '00:00:10',
  })) {
    if(trs.length === 0) {
      t.is(res.length, 10)
    }
    trs.push(...res)
  }
  t.is(trs[0].trade_time_utc, '00:00:09')
  t.is(trs[trs.length - 1].trade_time_utc, '00:00:00')
  trs.reduce((pre, tr) => {
    if(!pre) {
      return tr
    }
    t.true(pre.sequential_id > tr.sequential_id)
  }, null)
})

test('UPbitSequence#allTradesTicks()', async t => {
  const trs = await api.allTradesTicks({
    market: 'KRW-BTC',
    daysAgo: 0,
    count: 10,
    to: '00:00:10',
  })
  t.is(trs[0].trade_time_utc, '00:00:09')
  t.is(trs[trs.length - 1].trade_time_utc, '00:00:00')
  trs.reduce((pre, tr) => {
    if(!pre) {
      return tr
    }
    t.true(pre.sequential_id > tr.sequential_id)
  }, null)
})

test('UPbitSequence#eachTradesTicks()', async t => {
  let pre: Iu.TradeTickType
  for await (let tr of api.eachTradesTicks({
    market: 'KRW-BTC',
    daysAgo: 0,
    count: 10,
    to: '00:00:10',
  })) {
    if(!pre) {
      t.is(tr.trade_time_utc, '00:00:09')
      pre = tr
      continue
    }
    t.true(pre.sequential_id > tr.sequential_id)
    pre = tr
  }
  t.is(pre.trade_time_utc, '00:00:00')
  const daysAgo0 = new Date(pre.trade_date_utc)
  for await (let tr of api.eachTradesTicks({
    market: 'KRW-BTC',
    daysAgo: 1,
  })) {
    const daysAgo1 = new Date(tr.trade_date_utc)
    console.log(`daysAgo0: ${daysAgo0}`)
    console.log(`daysAgo1: ${daysAgo1}`)
    t.is(daysAgo0.getTime() - daysAgo1.getTime(), 1000 * 60 * 60 * 24)
    break
  }
})

test('UPbitSequence#chunkCandlesMinutes()', async t => {
  const cs: Iu.CandleMinuteType[] = []
  for await (let res of api.chunkCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: '2021-08-20T00:00:00+00:00',
    to: '2021-08-20T01:00:00+00:00',
    count: 10,
  })) {
    t.is(res.length, 10)
    cs.push(...res)
  }
  t.is(cs.length, 60)
  t.is(cs[0].candle_date_time_utc, '2021-08-20T00:59:00')
  t.is(cs[cs.length - 1].candle_date_time_utc, '2021-08-20T00:00:00')
  cs.reduce((time, c) => {
    t.is(new Date(c.candle_date_time_utc + '+00:00').getTime(), time)
    return time - (1000 * 60)
  }, new Date('2021-08-20T01:00:00+00:00').getTime() - (1000 * 60))
})

test('UPbitSequence#allCandlesMinutes()', async t => {
  const cs = await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: '2021-08-20T00:00:00+00:00',
    to: '2021-08-20T01:00:00+00:00',
    count: 10,
  })
  t.is(cs.length, 60)
  t.is(cs[0].candle_date_time_utc, '2021-08-20T00:59:00')
  t.is(cs[cs.length - 1].candle_date_time_utc, '2021-08-20T00:00:00')
  cs.reduce((time, c) => {
    t.is(new Date(c.candle_date_time_utc + '+00:00').getTime(), time)
    return time - (1000 * 60)
  }, new Date('2021-08-20T01:00:00+00:00').getTime() - (1000 * 60))
})

test('UPbitSequence#eachCandlesMinutes()', async t => {
  let time = new Date('2021-08-20T01:00:00+00:00').getTime()
  let count = 0
  let latest: Iu.CandleMinuteType
  for await (let c of api.eachCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: '2021-08-20T00:00:00+00:00',
    to: '2021-08-20T01:00:00+00:00',
    count: 10,
  })) {
    if(count === 0) {
      console.log(c.candle_date_time_utc)
      t.is(c.candle_date_time_utc, '2021-08-20T00:59:00')
    }
    time -= 1000 * 60
    t.is(new Date(c.candle_date_time_utc + '+00:00').getTime(), time)
    latest = c
    count++
  }
  t.is(count, 60)
  console.log(latest.candle_date_time_utc)
  t.is(latest.candle_date_time_utc, '2021-08-20T00:00:00')
})
