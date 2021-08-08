import test from 'ava'
import {
  TradeDb,
} from '../src/database'
import {
  remove,
} from 'fs-extra'
import {
  join,
} from 'path'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  getConfig,
} from '../src'


test.before(() => remove(join(__dirname, 'test.db')))

const codes = [
  "KRW-BTC",
  "KRW-ETH",
  "KRW-NEO",
  "KRW-MTL",
]
const api = new UPbit(getConfig('./config.json').upbit_keys)

test.serial('TradeDb#ready(): error', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  try {
    await db.ready()
  } catch(e) {
    t.is(e.message, `${join(__dirname, 'test.db')} database가 없기 때문에 인수를 전달해야 한다.`)
  }
})

test.serial('TradeDb#ready()', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  const count = await db.ready(codes, {
    api,
    daysAgo: 0,
    to: '00:00:10',
  })
  t.true(count > 0)
})

test.serial('TradeDb#ready() again', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  const count = await db.ready()
  t.is(count, 0)
  t.pass()
})

test.serial('TradeDb#count()', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  await db.ready()
  const count = await db.count(codes[0])
  t.true(count > 0)
})

test.serial('TradeDb#get()', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  await db.ready(codes, {
    api,
    daysAgo: 0,
    to: '00:00:10',
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
  const db = new TradeDb(join(__dirname, 'test.db'))
  await db.ready()
  for(let i = 0; i < 4; i++) {
    let count = 0
    let pre: Iu.TradeTickType = null
    for await (let tr of db.each(codes[i])) {
      if(pre) {
        t.true(pre.sequential_id < tr.sequential_id)
      }
      count += 1
      pre = tr
    }
    t.true(count > 0)
    t.is(count, await db.count(codes[i]))
  }
})

test.serial('TradeDb#each() long', async t => {
  t.timeout(1000000)
  await remove(join(__dirname, 'test.db'))
  const db = new TradeDb(join(__dirname, 'test.db'))
  await db.ready(['KRW-BTC'], {
    api,
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
