import test, {
  ExecutionContext,
} from 'ava'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import {
  getConfig,
  BaseSocketBot,
  types as I,
  TradeDb,
  UPbitTradeMock,
} from '../src'
import {
  join,
} from 'path'


const config = getConfig('./config.json')


class TestTradeBot extends BaseSocketBot {
  public pre: I.TradeType = null
  public count = 0
  public started = false
  public finished = false

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start() {
    this.started = true
    console.log('started')
  }

  async finish() {
    this.finished = true
    console.log('finished')
  }

  async onTrade(tr: I.TradeType) {
    this.count++
    if(this.pre === null) {
      this.pre = tr
      return
    }
    this.t.true(tr.sequential_id > this.pre.sequential_id)
    this.t.deepEqual(Object.keys(tr), [
      'type',
      'code',
      'trade_price',
      'trade_volume',
      'ask_bid',
      'prev_closing_price',
      'change',
      'change_price',
      'trade_date',
      'trade_time',
      'trade_timestamp',
      'timestamp',
      'sequential_id',
      'stream_type',
    ])
    this.pre = tr
    return false
  }

  onOrderbook = null
  onTicker = null
}


const codes = [
  "KRW-BTC",
  "KRW-ETH",
  "KRW-NEO",
  "KRW-MTL",
]

test.serial('UPbitTradeMock', async t => {
  const api = new UPbit(config.upbit_keys)
  const db = new TradeDb(join(__dirname, 'mock-test.db'))
  await db.ready(codes, {
    api,
    daysAgo: 0,
    to: '00:00:10',
  })
  const mock = new UPbitTradeMock(db)
  mock.addBot(new TestTradeBot('KRW-BTC', t))
  await mock.open()
  const bot: TestTradeBot = mock.getBots(I.ReqType.Trade, 'KRW-BTC')[0] as TestTradeBot
  t.true(bot.started)
  t.true(bot.finished)
  t.true(bot.count > 0)
  t.is(bot.count, await db.count('KRW-BTC'))
  t.is(bot.pre.trade_time, '00:00:09')
})