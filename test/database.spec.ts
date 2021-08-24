import test from 'ava'
import {
  TradeDb,
} from '../src/database'
import {
  removeSync,
} from 'fs-extra'
import {
  join,
} from 'path'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  CandleDb,
  getConfig,
  UPbitSequence
} from '../src'


test.before(() => {
  removeSync(join(__dirname, 'trade.db'))
  removeSync(join(__dirname, 'candle.db'))
})

const codes = [
  "KRW-BTC",
  "KRW-ETH",
  "KRW-NEO",
  "KRW-MTL",
]


const api = new UPbitSequence(getConfig('./config.json').upbit_keys)


test.serial('TradeDb#ready(): error', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  try {
    await db.ready()
  } catch(e) {
    t.is(e.message, `${join(__dirname, 'trade.db')} database가 없기 때문에 인수를 전달해야 한다.`)
  }
})

test.serial('TradeDb#ready()', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  const already = await db.ready(codes, {
    daysAgo: 0,
    to: '00:03:00',
  })
  t.false(already)
})

test.serial('TradeDb#ready() again', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  const already = await db.ready()
  t.true(already)
})

test.serial('TradeDb#count()', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  await db.ready()
  const count = await db.count(codes[0])
  t.true(count > 0)
})

test.serial('TradeDb#get()', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  await db.ready(codes, {
    daysAgo: 0,
    to: '00:03:00',
  })
  const count = await db.count(codes[0])
  const length = Math.floor(count / 3)
  const res: Iu.TradeTickType[] = []
  res.push(...await db.get(codes[0], length * 0, length))
  res.push(...await db.get(codes[0], length * 1, length))
  res.push(...await db.get(codes[0], length * 2, length))
  const remain = await db.get(codes[0], length * 3, length)
  t.is(res.length, length * 3)
  t.is(remain.length, count % 3)
  t.deepEqual(Object.keys(res[0]), [
    'market',
    'trade_date_utc',
    'trade_time_utc',
    'timestamp',
    'trade_price',
    'trade_volume',
    'prev_closing_price',
    'change_price',
    'ask_bid',
    'sequential_id',
  ])
  t.is(res[0].market, codes[0])
  const nothing = await db.get(codes[0], length * 4, length)
  t.is(nothing.length, 0)
})

test.serial('TradeDb#each()', async t => {
  const db = new TradeDb(join(__dirname, 'trade.db'))
  await db.ready()
  for(let i = 0; i < 4; i++) {
    let count = 0
    const nas = (await api.allTradesTicks({
      market: codes[i],
      daysAgo: 0,
      to: '00:03:00',
    })).reverse()
    for await (let tr of db.each(codes[i])) {
      t.deepEqual(tr, nas[count])
      count += 1
    }
    t.true(count > 0)
    t.is(count, await db.count(codes[i]))
  }
})

test.serial.skip('TradeDb#each() long', async t => {
  t.timeout(1000000)
  // await removeSync(join(__dirname, 'test-long.db'))
  const db = new TradeDb(join(__dirname, 'test-long.db'))
  await db.ready(['KRW-BTC'], {
    daysAgo: 1,
    to: '00:00:10',
  })
  let count = 0
  let pre: Iu.TradeTickType = null
  for await (let tr of db.each('KRW-BTC')) {
    if(pre) {
      t.true(pre.sequential_id < tr.sequential_id)
    }
    count += 1
    pre = tr
  }
  t.true(count > 0)
  t.is(count, await db.count('KRW-BTC'))
})


test.serial('CandleDb#ready(): error', async t => {
  const db = new CandleDb(join(__dirname, 'candle.db'))
  try {
    await db.ready()
  } catch(e) {
    t.is(e.message, `${join(__dirname, 'candle.db')} database가 없기 때문에 인수를 전달해야 한다.`)
  }
})

const from = '2021-08-24T00:00:00'
const to = '2021-08-24T10:00:00'

test.serial('CandleDb#ready()', async t => {
  const db = new CandleDb(join(__dirname, 'candle.db'))
  const already = await db.ready(codes, {
    min: 10,
    from: from + '+09:00',
    to: to + '+09:00',
  })
  t.false(already)
})

test.serial('CandleDb#ready() again', async t => {
  const db = new CandleDb(join(__dirname, 'candle.db'))
  const already = await db.ready()
  t.true(already)
})

test.serial('CandleDb#count()', async t => {
  const db = new TradeDb(join(__dirname, 'candle.db'))
  await db.ready()
  const count = await db.count(codes[0])
  t.is(count, 60)
})

test.serial('CandleDb#get()', async t => {
  const db = new CandleDb(join(__dirname, 'candle.db'))
  await db.ready(codes, {
    min: 10,
    from: from + '+09:00',
    to: to + '+09:00',
  })
  const count = await db.count(codes[0])
  const length = Math.floor(count / 3)
  const res: Iu.CandleMinuteType[] = []
  res.push(...await db.get(codes[0], length * 0, length))
  res.push(...await db.get(codes[0], length * 1, length))
  res.push(...await db.get(codes[0], length * 2, length))
  const remain = await db.get(codes[0], length * 3, length)
  t.is(res.length, length * 3)
  t.is(remain.length, count % 3)
  t.deepEqual(Object.keys(res[0]), [
    'market',
    'candle_date_time_utc',
    'candle_date_time_kst',
    'opening_price',
    'high_price',
    'low_price',
    'trade_price',
    'timestamp',
    'candle_acc_trade_price',
    'candle_acc_trade_volume',
    'unit',
  ])
  t.is(res[0].market, codes[0])
  const nothing = await db.get(codes[0], length * 4, length)
  t.is(nothing.length, 0)
})

test.serial('CandleDb#each()', async t => {
  const db = new CandleDb(join(__dirname, 'candle.db'))
  await db.ready()
  for(let i = 0; i < 4; i++) {
    const time = new Date(from + '+09:00').getTime()
    let count = 0
    const nas = (await api.allCandlesMinutes(10, {
      market: codes[i],
      from: from + '+09:00',
      to: to + '+09:00',
    })).reverse()
    for await (let tr of db.each(codes[i])) {
      t.deepEqual(tr, nas[count])
      t.is(time + (1000 * 60 * 10 * count), new Date(tr.candle_date_time_utc + '+00:00').getTime())
      count += 1
    }
    t.is(count, 60)
    t.is(count, await db.count(codes[i]))
  }
})

