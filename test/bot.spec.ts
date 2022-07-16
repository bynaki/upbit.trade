import test, {
  ExecutionContext,
} from 'ava'
import {
  UPbitSocket,
  BaseBot,
  types as I,
  addCandleListener,
  BaseUPbitSocket,
} from '../src'
import $4 from 'fourdollar'
import {
  join,
} from 'path'
import {
  readFile,
} from 'fs/promises'
import {
  remove, removeSync,
} from 'fs-extra'
import Observable from 'zen-observable'




test('Bot#name', t => {
  const bot = new TestBot('KRW-BTC')
  t.is(bot.name, 'TestBot:KRW-BTC')
})

test('UPbitSocket#open() & UPbitSocket#close()', async t => {
  const us = new UPbitSocket()
  t.is(us.state, I.SocketState.Closed)
  await us.open()
  t.is(us.state, I.SocketState.Open)
  await us.close()
  t.is(us.state, I.SocketState.Closed)
})

test('UPbitSocket#addBot(): 이름이 같으면 추가되지 않는다.', t => {
  const us = new UPbitSocket()
  us.addBot(new TestBot('KRW-BTC'))
  us.addBot(new TestBot('KRW-BTC'))
  t.is(us.getBots().length, 1)
  // console.log(us.getBots().map(b => b.name))
})

test('UPbitSocket#addBot(): 같은 클래스라도 이름이 다르면 추가된다.', t => {
  const us = new UPbitSocket()
  us.addBot(new IdBot('KRW-BTC', 1))
  us.addBot(new IdBot('KRW-BTC', 2))
  t.is(us.getBots().length, 2)
  t.is(us.getBots()[0].name, 'IdBot:KRW-BTC:1')
  t.is(us.getBots()[1].name, 'IdBot:KRW-BTC:2')
  us.addBot(...[new IdBot('KRW-BTC', 3), new IdBot('KRW-BTC', 4)])
})

test('UPbitSocket#addBot(): 여러개 추가할 수 있다.', t => {
  const us = new UPbitSocket()
  us.addBot(...[new IdBot('KRW-BTC', 1), new IdBot('KRW-BTC', 2)])
  us.addBot(...[new TestBot('KRW-BTC'), new TestBot('KRW-ETH')])
  t.is(us.getBots().length, 4)
})

test('UPbitSocket#addBotClass(): 클래스 단위로 추가할 수 있다.', t => {
  const us = new UPbitSocket()
  us.addBotClass(TestBot, [
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
  ])
  const bots = us.getBots()
  t.is(bots.length, 5)
  t.deepEqual(bots.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot:KRW-ETH',
    'TestBot:KRW-NEO',
    'TestBot:KRW-MTL',
    'TestBot:KRW-LTC',
  ])
})

test('UPbitSocket#addBot() & UPbitSocket#getBots()', t => {
  const us = new UPbitSocket()
  us.addBotClass(TestBot, [
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
  ])
  const bots = us.getBots(I.ReqType.Trade)
  t.is(bots.length, 5)
  t.deepEqual(bots.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot:KRW-ETH',
    'TestBot:KRW-NEO',
    'TestBot:KRW-MTL',
    'TestBot:KRW-LTC',
  ])
  t.is(us.getBots().length, 5)
  us.addBotClass(TestBot2, [
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
  ])
  const b2 = us.getBots(I.ReqType.Trade)
  t.is(b2.length, 10)
  t.deepEqual(b2.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot:KRW-ETH',
    'TestBot:KRW-NEO',
    'TestBot:KRW-MTL',
    'TestBot2:KRW-MTL',
    'TestBot:KRW-LTC',
    'TestBot2:KRW-LTC',
    'TestBot2:KRW-XRP',
    'TestBot2:KRW-ETC',
    'TestBot2:KRW-OMG',
  ])
  t.is(us.getBots().length, 10)
  const b2_1 = us.getBots(I.ReqType.Orderbook)
  t.is(b2_1.length, 5)
  t.deepEqual(b2_1.map(b => b.name), [
    'TestBot2:KRW-MTL',
    'TestBot2:KRW-LTC',
    'TestBot2:KRW-XRP',
    'TestBot2:KRW-ETC',
    'TestBot2:KRW-OMG',
  ])
  us.addBot(new TestBot3('KRW-BTC'))
  const b3 = us.getBots(I.ReqType.Trade, 'KRW-BTC')
  t.is(b3.length, 2)
  t.deepEqual(b3.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot3:KRW-BTC',
  ])
  const b4 = us.getBots(I.ReqType.Orderbook, 'KRW-MTL')
  t.is(b4.length, 1)
  t.deepEqual(b4.map(b => b.name), [
    'TestBot2:KRW-MTL',
  ])
  const b5 = us.getBots(I.ReqType.Ticker)
  t.is(b5.length, 0)
  t.is(us.getBots().length, 11)
})

test('UPbitSocket#requests()', t => {
  const us = new UPbitSocket()
  us.addBotClass(TestBot, [
    'KRW-BTC',
    'KRW-ETH',
    'KRW-XRP',
  ])
  us.addBotClass(TestBot2, [
    'KRW-ETH',
    'KRW-XRP',
    'KRW-ETC',
  ])
  const req = us.requests()
  t.deepEqual(req, [
    {ticket: us.uuid},
    {
      type: 'trade',
      codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-XRP',
        'KRW-ETC',
      ],
      // isOnlyRealtime: true,
    },
    {
      type: 'orderbook',
      codes: [
        'KRW-ETH',
        'KRW-XRP',
        'KRW-ETC',
      ],
      // isOnlyRealtime: true,
    },
  ])
})

test.serial('TestTradeBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestTradeBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestOrderbookBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestOrderbookBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestTickerBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestTickerBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestLogBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestLogBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestQueueBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestQueueBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestCandleQueueBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestCandleQueueBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('TestLatestBot', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestLatestBot('KRW-BTC', t, obs))
    us.open()
  })
})



test.before(() => {
  removeSync(join(__dirname, 'test-bot.db'))
})



class TestBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  start = null!
  finish = null!
  onOrderbook = null!
  onTicker = null!
}



class TestBot2 extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  start = null!
  finish = null!
  onTicker = null!
}

class TestBot3 extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  start = null!
  finish = null!
  onClose = null!
  onTicker = null!
}



class TestTradeBot extends BaseBot {
  private _tr: I.TradeType[] = []

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(50)
  }

  async start() {
    this.t.pass()
  }

  async onTrade(data: I.TradeType) {
    if(this._tr.length < 10) {
      this._tr.push(data)
      this.t.deepEqual(Object.keys(data), [
        'type',
        'code',
        'timestamp',
        'trade_date',
        'trade_time',
        'trade_timestamp',
        'trade_price',
        'trade_volume',
        'ask_bid',
        'prev_closing_price',
        'change',
        'change_price',
        'sequential_id',
        'stream_type',
      ])
      this.t.is(data.type, I.ReqType.Trade)
      this.t.is(data.code, 'KRW-BTC')
    } else {
      this.t.is(this._tr.length, 10)
      this._tr.reduce((p, c) => {
        if(p) {
          this.t.true(p.trade_timestamp <= c.trade_timestamp)
          this.t.true(p.sequential_id < c.sequential_id)
        }
        return c
      })
      this.obs.complete()
    }
  }

  finish = null!
  onOrderbook = null!
  onTicker = null!
}



class TestOrderbookBot extends BaseBot {
  private _td: I.OrderbookType[] = []

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(61)
  }

  async start() {
    this.t.pass()
  }

  async onOrderbook(data: I.OrderbookType) {
    if(this._td.length < 10) {
      this._td.push(data)
      this.t.deepEqual(Object.keys(data), [
        'type',
        'code',
        'timestamp',
        'total_ask_size',
        'total_bid_size',
        'orderbook_units',
        'stream_type',
      ])
      this.t.is(data.orderbook_units.length, 15)
      this.t.deepEqual(Object.keys(data.orderbook_units[0]), [
        'ask_price',
        'bid_price',
        'ask_size',
        'bid_size',
      ])
      this.t.is(data.type, I.ReqType.Orderbook)
      this.t.is(data.code, 'KRW-BTC')
    } else {
      this.t.is(this._td.length, 10)
      this._td.reduce((p, c) => {
        if(p) {
          this.t.true(p.timestamp < c.timestamp)
        }
        return c
      })
      this.obs.complete()
    }
  }

  finish = null!
  onTrade = null!
  onTicker = null!
}



class TestTickerBot extends BaseBot {
  private _td: I.TickerType[] = []

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(41)
  }

  async start() {
    this.t.pass()
  }

  async onTicker(data: I.TickerType) {
    if(this._td.length < 10) {
      this._td.push(data)
      this.t.deepEqual(Object.keys(data).sort(), [
        'type',                 'code',
        'opening_price',        'high_price',
        'low_price',            'trade_price',
        'prev_closing_price',   'acc_trade_price',
        'change',               'change_price',
        'signed_change_price',  'change_rate',
        'signed_change_rate',   'ask_bid',
        'trade_volume',         'acc_trade_volume',
        'trade_date',           'trade_time',
        'trade_timestamp',      'acc_ask_volume',
        'acc_bid_volume',       'highest_52_week_price',
        'highest_52_week_date', 'lowest_52_week_price',
        'lowest_52_week_date',  /*'trade_status',*/
        'market_state',         /*'market_state_for_ios',*/
        'is_trading_suspended', 'delisting_date',
        'market_warning',       'timestamp',
        'acc_trade_price_24h',  'acc_trade_volume_24h',
        'stream_type',
      ].sort())
      this.t.is(data.type, I.ReqType.Ticker)
      this.t.is(data.code, 'KRW-BTC')
    } else {
      this.t.is(this._td.length, 10)
      this._td.reduce((p, c) => {
        if(p) {
          this.t.true(p.trade_timestamp <= c.trade_timestamp)
        }
        return c
      })
      this.obs.complete()
    }
  }

  finish = null!
  onOrderbook = null!
  onTrade = null!
}



class TestQueueBot extends BaseBot {
  private _count = 3
  private _datas: I.TradeType[] = []

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    t.plan(7)
  }

  async start() {
    this.t.pass()
  }
  
  async onTrade(data: I.TradeType) {
    if(this._count === -1) {
      const t = this.t
      //console.log(`data.length: ${this._datas.length}`)
      this._datas.reduce((p, d) => {
        //console.log(d)
        if(p) {
          t.true(p.trade_timestamp <= d.trade_timestamp)
          t.true(p.sequential_id < d.sequential_id)
        }
        return d
      })
      this.obs.complete()
      return
    }
    const ms = this._count-- * 1000
    await $4.stop(ms)
    this.log(`count: ${this._count}`, data)
    this._datas.push(data)
  }

  finish = null!
  onOrderbook = null!
  onTicker = null!
}



class TestCandleQueueBot extends BaseBot {
  private count = 3
  private tr: I.TradeType

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    t.plan(3)
  }

  async start() {
    this.t.pass()
  }
  
  async onTrade(tr: I.TradeType) {
    this.tr = tr
  }

  @addCandleListener(1, 10)
  async m1(ohlc: I.OHLCType[]) {
    if(--this.count <= 0) {
      this.obs.complete()
      return
    }
    await $4.stop(1000)
    // console.log(ohlc)
    // console.log(this.tr)
    this.t.true(ohlc[0].close === this.tr.trade_price)
  }

  finish = null!
  onOrderbook = null!
  onTicker = null!
}



class TestLatestBot extends BaseBot {
  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    t.plan(4)
  }

  async start() {
    this.t.pass()
  }

  async onTrade(res: I.TradeType) {
    this.t.true(this.latest(I.ReqType.Trade) !== null)
    this.t.true(this.latest(I.ReqType.Orderbook) !== null)
    this.t.true(this.latest(I.ReqType.Ticker) === null)
    this.obs.complete()
  }

  async onOrderbook(res: I.OrderbookType) {
    this.t.true(this.latest(I.ReqType.Trade) !== null)
    this.t.true(this.latest(I.ReqType.Orderbook) !== null)
    this.t.true(this.latest(I.ReqType.Ticker) === null)
    this.obs.complete()
  }
  
  finish = null!
  onTicker = null!
}



class TestLogBot extends BaseBot {
  private _origin
  private socket: BaseUPbitSocket

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: ZenObservable.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(2)
  }
  
  async start(socket: BaseUPbitSocket) {
    this.socket = socket
    this._origin = TestLogBot.writer
    TestLogBot.writer = new $4.FileWriter(join(__dirname, 'log', 'test.log'), '1d')
    this.t.pass()
  }

  async onTrade(data: I.TradeType) {
    this.log('Hello World!!')
    await $4.stop(500)
    const contents = await readFile(join(__dirname, 'log', 'test.log'))
    const reg = /log: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} > TestLogBot:KRW-BTC - Hello World!!/
    this.t.regex(contents.toString(), reg)
    TestLogBot.writer = this._origin
    this.obs.complete()
    await this.socket.close()
  }

  onOrderbook = null!
  onTicker = null!
  finish = null!
}



class IdBot extends BaseBot {
  constructor(code: string, public readonly id: number) {
    super(code)
  }

  get name() {
    return super.name + ':' + this.id
  }

  async onTrade(tr: I.TradeType): Promise<void> {
  }

  onOrderbook = async (aa: I.OrderbookType): Promise<void> => {
    return
  }

  onTicker = null!
  start = null!
  finish = null!
}



test.after(() => remove(join(__dirname, 'log')))