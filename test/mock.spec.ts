import test, {
  ExecutionContext,
} from 'ava'
import {
  BaseSocketBot,
  types as I,
  OrderMarket,
  UPbitTradeMock,
} from '../src'
import {
  join,
} from 'path'
import {
  removeSync,
} from 'fs-extra'



class TestTradeBot extends BaseSocketBot {
  public pre: I.TradeType = null
  public count = 0
  public started = 0
  public finished = 0
  private t: ExecutionContext = null

  constructor(code: string) {
    super(code)
  }

  setTestObject(t: ExecutionContext) {
    this.t = t
  }

  async start() {
    this.started += 1
    console.log('started')
  }

  async finish() {
    this.finished += 1
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
  }

  onOrderbook = null
  onTicker = null
}



class TestOrderBot extends BaseSocketBot {
  private order: OrderMarket

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start() {
    this.order = this.newOrderMarket()
    const error = this.t.throws(() => this.newOrder())
    this.t.is(error.message, "'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
  }

  async finish() {
    console.log(this.order.history)
  }

  async onTrade(tr: I.TradeType) {
    if(!await this.order.updateStatus()) {
      const status = await this.order.bid(10000)
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
  // "KRW-NEO",
  // "KRW-MTL",
]

test.before(() => {
  removeSync(join(__dirname, 'mock-test.db'))
})

test.serial('UPbitTradeMock', async t => {
  const mock = new UPbitTradeMock(join(__dirname, 'mock-test.db'), 'test_mock1', {
    daysAgo: 0,
    to: '00:00:10',
  })
  mock.addBotClass(TestTradeBot, [
    "KRW-BTC",
    "KRW-ETH",
  ])
  const bots: TestTradeBot[] = mock.getBots(I.ReqType.Trade)
  bots.forEach(bot => bot.setTestObject(t))
  await mock.open()
  for(let bot of bots) {
    t.is(bot.started, 1)
    t.is(bot.finished, 1)
    t.true(bot.count > 0)
    t.is(bot.pre.trade_time, '00:00:09')
  }
})

test.serial('OrderMarketMock', async t => {
  const mock = new UPbitTradeMock(join(__dirname, 'mock-test.db'), 'test_mock1', {
    daysAgo: 0,
    to: '00:00:10',
  })
  mock.addBotClass(TestTradeBot, [
    "KRW-BTC",
    "KRW-ETH",
  ])
  mock.addBot(new TestOrderBot('KRW-BTC', t))
  await mock.open()
})