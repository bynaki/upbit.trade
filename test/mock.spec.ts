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
  OrderMarketMock,
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



class TestOrderBot extends BaseSocketBot {
  private order: OrderMarketMock

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start() {
    
    this.order = new OrderMarketMock(this)
  }

  async finish() {
    console.log(this.order.history)
  }

  async onTrade(tr: I.TradeType) {
    if(!await this.order.updateStatus()) {
      const status = await this.order.bid({market: this.code, price: 10000})
      console.log(status)
      this.t.is(status.side, 'bid')
      this.t.is(status.ord_type, 'price')
      this.t.is(status.price, 10000)
      this.t.is(status.state, 'wait')
      this.t.is(status.market, 'KRW-BTC')
      this.t.is(status.executed_volume, 0)
      this.t.is(status.trades_count, 0)
      const updated = await this.order.updateStatus()
      console.log(updated)
      this.t.is(updated.uuid, status.uuid)
      this.t.is(updated.state, 'cancel')
      this.t.true(updated.executed_volume !== 0)
      this.t.is(updated.trades_count, 1)
      this.t.is(updated.trades.length, 1)
      this.t.is(updated.trades[0].funds, 10000)
    }
    if(tr.trade_time === '00:00:09' && this.order.status.side === 'bid') {
      const status = await this.order.ask()
      console.log(status)
      this.t.is(status.side, 'ask')
      this.t.is(status.ord_type, 'market')
      this.t.is(status.price, null)
      this.t.is(status.state, 'wait')
      this.t.true(status.volume !== null)
      this.t.is(status.market, 'KRW-BTC')
      this.t.is(status.executed_volume, 0)
      this.t.is(status.trades_count, 0)
      const updated = await this.order.updateStatus()
      console.log(updated)
      this.t.is(updated.uuid, status.uuid)
      this.t.is(updated.state, 'done')
      this.t.true(updated.executed_volume !== 0)
      this.t.is(updated.trades_count, 1)
      this.t.is(updated.trades.length, 1)
    }
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

test.serial('OrderMarketMock', async t => {
  const api = new UPbit(config.upbit_keys)
  const db = new TradeDb(join(__dirname, 'mock-test.db'))
  await db.ready(codes, {
    api,
    daysAgo: 0,
    to: '00:00:10',
  })
  const mock = new UPbitTradeMock(db)
  mock.addBot(new TestOrderBot('KRW-BTC', t))
  await mock.open()
  t.pass()
})