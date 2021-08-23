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
  getConfig,
} from '../src'


test.before(() => removeSync(join(__dirname, 'test.db')))

const codes = [
  "KRW-BTC",
  "KRW-ETH",
  "KRW-NEO",
  "KRW-MTL",
]
const api = new UPbit(getConfig('./config.json').upbit_keys)


async function getTradesTicks(api: UPbit, opts: {
  market: string,
  daysAgo?: number,
  to?: string,
  cursor?: number,
}): Promise<Iu.TradeTickType[]> {
  const {market, daysAgo, to, cursor} = opts
  const trs = (await api.getTradesTicks({
    market,
    count: 500,
    daysAgo,
    to,
    cursor,
  })).data
  if(trs.length === 0) {
    return trs
  }
  trs.push(...(await getTradesTicks(api, {market, daysAgo, cursor: trs[trs.length - 1].sequential_id})))
  return trs
}

test.serial('getTradesTicks()', async t => {
  const trs = (await getTradesTicks(api, {
    market: 'KRW-BTC',
    daysAgo: 0,
    to: '00:03:00',
  })).reverse()
  console.log(`trs count: ${trs.length}`)
  t.true(trs.length > 0)
  trs.reduce((pre, tr) => {
    if(pre === null) {
      return tr
    }
    t.true(tr.sequential_id > pre.sequential_id)
    return tr
  }, null)
  t.is(trs.pop().trade_time_utc, '00:02:59')
})


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
  const already = await db.ready(codes, {
    daysAgo: 0,
    to: '00:03:00',
  })
  t.false(already)
})

test.serial('TradeDb#ready() again', async t => {
  const db = new TradeDb(join(__dirname, 'test.db'))
  const already = await db.ready()
  t.true(already)
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
  const db = new TradeDb(join(__dirname, 'test.db'))
  await db.ready()
  for(let i = 0; i < 4; i++) {
    let count = 0
    const nas = (await getTradesTicks(api, {
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

test.serial('TradeDb#each() long', async t => {
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
