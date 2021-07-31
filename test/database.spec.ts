import test from 'ava'
import {
  TradeDB,
} from '../src/database'
import {
  remove,
} from 'fs-extra'
import {
  join,
} from 'path'
import {
  UPbit,
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

test.serial('TradeDB#ready()', async t => {
  const db = new TradeDB(join(__dirname, 'test.db'))
  const res = await db.ready(codes)
  t.deepEqual(res, codes)
  t.pass()
})

test.serial('TradeDB#ready() again', async t => {
  const db = new TradeDB(join(__dirname, 'test.db'))
  const res = await db.ready(null)
  t.deepEqual(res, codes)
  t.pass()
})

test.serial('TradeDB#insert()', async t => {
  t.timeout(1000000)
  const db = new TradeDB(join(__dirname, 'test.db'))
  await db.ready(codes)
  const count = await db.insert({
    api,
    code: codes[0],
    daysAgo: 1,
    to: '00:00:10',
  })
  console.log(`count: ${count}`)
  t.true(count > 0)
})
