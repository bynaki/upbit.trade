import test from 'ava'
import {
  UPbitSequence,
  getConfig,
  upbit_types as Iu,
} from '../src'


const api = new UPbitSequence(getConfig('./config.json').upbit_keys)


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


test('UPbitSequence#eachCaldesMinutes()', async t => {
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
