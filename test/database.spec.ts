import test from 'ava'
import {
  removeSync,
} from 'fs-extra'
import {
  join,
} from 'path'
import {
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  CandleTableType,
  DbCandleMinuteType,
  DbTradeTickType,
  getConfig,
  readyCandle,
  readyTrade,
  TradeTableType,
  UPbitSequence,
} from '../src'
import { toNumber } from 'lodash'



test.before(() => {
  removeSync(join(__dirname, 'test-db.db'))
})

const codes = [
  "KRW-BTC",
  "KRW-ETH",
  "KRW-NEO",
  "KRW-MTL",
]



test.serial('readyTrade(): 데이터베이스 테이블이 존재하지 않은면 params 인수를 생략하면 에러가 발생한다.', async t => {
  try {
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade')
  } catch(e) {
    t.is(e.message, `'${join(__dirname, 'test-db.db')}' 데이터베이스에 'trade' 테이블이 없다.`)
  }
})

test.serial('readyCandle(): 데이터베이스 테이블이 존재하지 않은면 params 인수를 생략하면 에러가 발생한다.', async t => {
  try {
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle')
  } catch(e) {
    t.is(e.message, `'${join(__dirname, 'test-db.db')}' 데이터베이스에 'candle' 테이블이 없다.`)
  }
})

{
  let type: TradeTableType

  test.serial('readyTrade(): api에서 trade 데이터를 가져와 데이터베이스에 저장하고 시간 순서대로 가져온다.', async t => {
    const params = {
      daysAgo: 0,
      to: '00:01:00',
      codes,
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
    type = await db.getType()
    console.log(type)
    t.deepEqual(type, {
      name: 'trade',
      create_date: type.create_date,
      params,
      order_by: 'sequential_id',
    })
    let got: DbTradeTickType
    for await (got of db.each()) {
    }
    t.is(got!.trade_time_utc, '00:00:59')
  })

  test.serial('readyTrade(): 데이터베이스 테이블이 존재할 때 같은 인수를 전달하면 api에서 가져오지 않고 바로 데이터베이스에서 가져온다.', async t => {
    const params = {
      daysAgo: 0,
      to: '00:01:00',
      codes,
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
    t.is((await db.getType()).create_date, type.create_date)
    let got: DbTradeTickType
    for await (got of db.each()) {
    }
    t.is(got!.trade_time_utc, '00:00:59')
  })

  test.serial('readyTrade(): 데이터베이스 테이블이 존재할 때 인수를 생략할 수 있다.', async t => {
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade')
    t.is((await db.getType()).create_date, type.create_date)
    let got: DbTradeTickType
    for await (got of db.each()) {
    }
    t.is(got!.trade_time_utc, '00:00:59')
  })

  test.serial('readyTrade(): 데이터베이스 테이블이 존재하더라도 그전 인수와 다르다면 api에서 새로 가져온다.', async t => {
    const params = {
      daysAgo: 0,
      to: '00:00:30',
      codes,
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
    t.not((await db.getType()).create_date, type.create_date)
    let got: DbTradeTickType
    for await (got of db.each()) {
    }
    t.is(got!.trade_time_utc, '00:00:29')
  })

  test.serial('readyTrade(): code별로 가져올 수 있다.', async t => {
    const params = {
      daysAgo: 0,
      to: '00:00:30',
      codes,
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
    for await (const got of db.each(codes[0])) {
      t.is(got.market, codes[0])
    }
  })

  test.serial('readyTrade(): count를 구할 수 있다.', async t => {
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade')
    let count = 0
    for await (const tr of db.each()) {
      count++
    }
    t.is(await db.count(), count)
    count = 0
    for await (const tr of db.each(codes[0])) {
      count++
    }
    t.is(await db.count(codes[0]), count)
  })

}

{
  const comins = codes.map(c => c + ':1')
  let type: CandleTableType

  test.serial('readyCandle(): api에서 candle 데이터를 가져와 데이터베이스에 저장하고 시간 순서대로 가져온다.', async t => {
    const params = {
      comins,
      from: '2021-08-24T00:00:00+00:00',
      to: '2021-08-24T00:10:00+00:00',
    }
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle', params)
    type = await db.getType()
    console.log(type)
    t.deepEqual(type, {
      name: 'candle',
      create_date: type.create_date,
      params,
      order_by: 'timestamp',
    })
    const candles: DbCandleMinuteType[] = []
    for await (let got of db.each()) {
      candles.push(got)
    }
    t.is(candles.length, 40)
    t.is(candles[0].candle_date_time_utc, '2021-08-24T00:00:00')
    t.is(candles[0].unit, 1)
    t.is(candles[candles.length - 1].candle_date_time_utc, '2021-08-24T00:09:00')
  })

  test.serial('readyCandle(): 데이터베이스 테이블이 존재할 때 같은 인수를 전달하면 api에서 가져오지 않고 바로 데이터베이스에서 가져온다.', async t => {
    const params = {
      comins,
      from: '2021-08-24T00:00:00+00:00',
      to: '2021-08-24T00:10:00+00:00',
    }
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle', params)
    t.is((await db.getType()).create_date, type.create_date)
    const candles: DbCandleMinuteType[] = []
    for await (let got of db.each()) {
      candles.push(got)
    }
    t.is(candles.length, 40)
    t.is(candles[0].candle_date_time_utc, '2021-08-24T00:00:00')
    t.is(candles[0].unit, 1)
    t.is(candles[candles.length - 1].candle_date_time_utc, '2021-08-24T00:09:00')
  })

  test.serial('readyCandle(): 데이터베이스 테이블이 존재할 때 인수를 생략할 수 있다.', async t => {
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle')
    t.is((await db.getType()).create_date, type.create_date)
    const candles: DbCandleMinuteType[] = []
    for await (let got of db.each()) {
      candles.push(got)
    }
    t.is(candles.length, 40)
    t.is(candles[0].candle_date_time_utc, '2021-08-24T00:00:00')
    t.is(candles[0].unit, 1)
    t.is(candles[candles.length - 1].candle_date_time_utc, '2021-08-24T00:09:00')
  })

  test.serial('readyCandle(): 데이터베이스 테이블이 존재하더라도 그전 인수와 다르다면 api에서 새로 가져온다.', async t => {
    const params = {
      comins,
      from: '2021-08-24T00:00:00+00:00',
      to: '2021-08-24T00:05:00+00:00',
    }
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle', params)
    t.not((await db.getType()).create_date, type.create_date)
    const candles: DbCandleMinuteType[] = []
    for await (let got of db.each()) {
      candles.push(got)
    }
    t.is(candles.length, 20)
    t.is(candles[0].candle_date_time_utc, '2021-08-24T00:00:00')
    t.is(candles[0].unit, 1)
    t.is(candles[candles.length - 1].candle_date_time_utc, '2021-08-24T00:04:00')
  })

  test.serial('readyCandle(): code별로 가져올 수 있다.', async t => {
    const params = {
      comins,
      from: '2021-08-24T00:00:00+00:00',
      to: '2021-08-24T00:05:00+00:00',
    }
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle', params)
    t.not((await db.getType()).create_date, type.create_date)
    const candles: DbCandleMinuteType[] = []
    for await (let got of db.each(codes[0])) {
      candles.push(got)
    }
    t.is(candles.length, 5)
    candles.forEach(c => {
      t.is(c.market, codes[0])
    })
  })

  test.serial('readyCandle(): count를 구할 수 있다.', async t => {
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle')
    t.is(await db.count(), 20)
    t.is(await db.count(codes[0]), 5)
  })

}

test.serial('DbTable#get()', async t => {
  const params = {
    daysAgo: 0,
    to: '00:01:00',
    codes,
  }
  const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
  const count = await db.count(codes[0])
  const length = Math.floor(count / 3)
  const res: DbTradeTickType[] = []
  res.push(...await db.get({
    code: codes[0],
    offset: length * 0,
    length,
    orderBy: 'sequential_id',
  }))
  res.push(...await db.get({
    code: codes[0],
    offset: length * 1,
    length,
    orderBy: 'sequential_id',
  }))
  res.push(...await db.get({
    code: codes[0],
    offset: length * 2,
    length,
    orderBy: 'sequential_id',
  }))
  const remain = await db.get({
    code: codes[0],
    offset: length * 3,
    length,
    orderBy: 'sequential_id',
  })
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
  const nothing = await db.get({
    code: codes[0],
    offset: length * 4,
    length,
    orderBy: 'sequential_id',
  })
  t.is(nothing.length, 0)
})

function toTradeTickType(dbType: DbTradeTickType): Iu.TradeTickType {
  return Object.assign(dbType, {trade_volume: toNumber(dbType.trade_volume)})
}

function toCandleType(dbType: DbCandleMinuteType): Iu.CandleMinuteType {
  return Object.assign(dbType, {
    candle_acc_trade_price: toNumber(dbType.candle_acc_trade_price),
    candle_acc_trade_volume: toNumber(dbType.candle_acc_trade_volume),
  })
}

{
  const api = new UPbitSequence(getConfig().upbit_keys)

  test.serial('DbTable#each(): trade', async t => {
    const params = {
      daysAgo: 0,
      to: '00:01:00',
      codes,
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade', params)
    for(let i = 0; i < codes.length; i++) {
      let count = 0
      const nas = (await api.allTradesTicks({
        market: codes[i],
        daysAgo: 0,
        to: '00:01:00',
      })).reverse()
      for await (let tr of db.each(codes[i])) {
        t.deepEqual(toTradeTickType(tr), nas[count])
        count += 1
      }
      t.true(count > 0)
      t.is(count, await db.count(codes[i]))
    }
  })

  const comins = codes.map(c => c + ':1')
  test.serial('DbTable#each(): candle', async t => {
    const params = {
      comins,
      from: '2021-08-24T00:00:00+00:00',
      to: '2021-08-24T00:10:00+00:00',
    }
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle', params)
    for(let code of codes) {
      let count = 0
      const nas = (await api.allCandlesMinutes(1, {
        market: code,
        from: '2021-08-24T00:00:00+00:00',
        to: '2021-08-24T00:10:00+00:00',
      })).reverse()
      for await (const c of db.each(code)) {
        t.deepEqual(toCandleType(c), nas[count])
        count++
      }
      t.is(count, 10)
    }
  })

  test.serial('DbTable#each(): trade long', async t => {
    const params = {
      daysAgo: 1,
      to: '00:01:00',
      codes: ['KRW-BTC'],
    }
    const db = await readyTrade(join(__dirname, 'test-db.db'), 'trade_long', params)
    let pre: DbTradeTickType
    let count = 0
    for await (const tr of db.each()) {
      if(pre!) {
        t.true(pre.sequential_id < tr.sequential_id)
      }
      pre = tr
      count++
    }
    t.is(await db.count(), count)
    console.log(`trade long count: ${count}`)
  })

  test.serial('DbTable#each(): candle long', async t => {
    const db = await readyCandle(join(__dirname, 'test-db.db'), 'candle_long', {
      comins: ['KRW-BTC:1'],
      from: '2021-09-12T00:00:00+00:00',
      to: '2021-09-13T00:00:00+00:00',
    })
    let count = 0
    for await (const c of db.each()) {
      const time = new Date('2021-09-12T00:00:00+00:00').getTime() + (1000 * 60 * count)
      t.is(new Date(c.candle_date_time_utc + '+00:00').getTime(), time)
      count++
    }
    t.is(count, 60 * 24)
  })

}




// test.serial('CandleDb#ready(): error', async t => {
//   const db = new CandleDb(join(__dirname, 'candle.db'))
//   try {
//     await db.ready()
//   } catch(e) {
//     t.is(e.message, `${join(__dirname, 'candle.db')} database가 없기 때문에 인수를 전달해야 한다.`)
//   }
// })

// const from = '2021-08-24T00:00:00'
// const to = '2021-08-24T10:00:00'

// test.serial('CandleDb#ready()', async t => {
//   const db = new CandleDb(join(__dirname, 'candle.db'))
//   const already = await db.ready(codes, {
//     min: 10,
//     from: from + '+09:00',
//     to: to + '+09:00',
//   })
//   t.false(already)
// })

// test.serial('CandleDb#ready() again', async t => {
//   const db = new CandleDb(join(__dirname, 'candle.db'))
//   const already = await db.ready()
//   t.true(already)
// })

// test.serial('CandleDb#count()', async t => {
//   const db = new TradeDb(join(__dirname, 'candle.db'))
//   await db.ready()
//   const count = await db.count(codes[0])
//   t.is(count, 60)
// })

// test.serial('CandleDb#get()', async t => {
//   const db = new CandleDb(join(__dirname, 'candle.db'))
//   await db.ready(codes, {
//     min: 10,
//     from: from + '+09:00',
//     to: to + '+09:00',
//   })
//   const count = await db.count(codes[0])
//   const length = Math.floor(count / 3)
//   const res: Iu.CandleMinuteType[] = []
//   res.push(...await db.get(codes[0], length * 0, length))
//   res.push(...await db.get(codes[0], length * 1, length))
//   res.push(...await db.get(codes[0], length * 2, length))
//   const remain = await db.get(codes[0], length * 3, length)
//   t.is(res.length, length * 3)
//   t.is(remain.length, count % 3)
//   t.deepEqual(Object.keys(res[0]), [
//     'market',
//     'candle_date_time_utc',
//     'candle_date_time_kst',
//     'opening_price',
//     'high_price',
//     'low_price',
//     'trade_price',
//     'timestamp',
//     'candle_acc_trade_price',
//     'candle_acc_trade_volume',
//     'unit',
//   ])
//   t.is(res[0].market, codes[0])
//   const nothing = await db.get(codes[0], length * 4, length)
//   t.is(nothing.length, 0)
// })

// test.serial('CandleDb#each()', async t => {
//   const db = new CandleDb(join(__dirname, 'candle.db'))
//   await db.ready()
//   for(let i = 0; i < 4; i++) {
//     const time = new Date(from + '+09:00').getTime()
//     let count = 0
//     const nas = (await api.allCandlesMinutes(10, {
//       market: codes[i],
//       from: from + '+09:00',
//       to: to + '+09:00',
//     })).reverse()
//     for await (let tr of db.each(codes[i])) {
//       t.deepEqual(tr, nas[count])
//       t.is(time + (1000 * 60 * 10 * count), new Date(tr.candle_date_time_utc + '+00:00').getTime())
//       count += 1
//     }
//     t.is(count, 60)
//     t.is(count, await db.count(codes[i]))
//   }
// })