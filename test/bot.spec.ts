import test, {
  CbExecutionContext,
} from 'ava'
import WebSocket from 'ws'
import {
  UPbitSocket,
  BaseSocketBot,
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

test.serial.cb('TestTradeBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestTradeBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestOrderbookBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestOrderbookBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestTickerBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestTickerBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestLogBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestLogBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestQueueBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestQueueBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestCandleQueueBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestCandleQueueBot('KRW-BTC', t))
  us.open()
})

test.serial.cb('TestLatestBot', t => {
  const us = new UPbitSocket()
  us.addBot(new TestLatestBot('KRW-BTC', t))
  us.open()
})



test.before(() => {
  removeSync(join(__dirname, 'test-bot.db'))
})



class TestBot extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  start = null
  finish = null
  onOrderbook = null
  onTicker = null
}



class TestBot2 extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  start = null
  finish = null
  onTicker = null
}

class TestBot3 extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  start = null
  finish = null
  onClose = null
  onTicker = null
}



class TestTradeBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _tr: I.TradeType[] = []

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(50)
  }

  async start() {
    this._t.pass()
  }

  async onTrade(data: I.TradeType) {
    if(this._tr.length < 10) {
      this._tr.push(data)
      this._t.deepEqual(Object.keys(data), [
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
      this._t.is(data.type, I.ReqType.Trade)
      this._t.is(data.code, 'KRW-BTC')
    } else {
      this._t.is(this._tr.length, 10)
      this._tr.reduce((p, c) => {
        if(p !== null) {
          this._t.true(p.trade_timestamp <= c.trade_timestamp)
          this._t.true(p.sequential_id < c.sequential_id)
        }
        return c
      }, null)
      this._t.end()
    }
  }

  finish = null
  onOrderbook = null
  onTicker = null
}



class TestOrderbookBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _td: I.OrderbookType[] = []

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(61)
  }

  async start() {
    this._t.pass()
  }

  async onOrderbook(data: I.OrderbookType) {
    if(this._td.length < 10) {
      this._td.push(data)
      this._t.deepEqual(Object.keys(data), [
        'type',
        'code',
        'timestamp',
        'total_ask_size',
        'total_bid_size',
        'orderbook_units',
        'stream_type',
      ])
      this._t.is(data.orderbook_units.length, 15)
      this._t.deepEqual(Object.keys(data.orderbook_units[0]), [
        'ask_price',
        'bid_price',
        'ask_size',
        'bid_size',
      ])
      this._t.is(data.type, I.ReqType.Orderbook)
      this._t.is(data.code, 'KRW-BTC')
    } else {
      this._t.is(this._td.length, 10)
      this._td.reduce((p, c) => {
        if(p !== null) {
          this._t.true(p.timestamp < c.timestamp)
        }
        return c
      }, null)
      this._t.end()
    }
  }

  finish = null
  onTrade = null
  onTicker = null
}



class TestTickerBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _td: I.TickerType[] = []

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(41)
  }

  async start() {
    this._t.pass()
  }

  async onTicker(data: I.TickerType) {
    if(this._td.length < 10) {
      this._td.push(data)
      this._t.deepEqual(Object.keys(data), [
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
        'lowest_52_week_date',  'trade_status',
        'market_state',         'market_state_for_ios',
        'is_trading_suspended', 'delisting_date',
        'market_warning',       'timestamp',
        'acc_trade_price_24h',  'acc_trade_volume_24h',
        'stream_type',
      ])
      this._t.is(data.type, I.ReqType.Ticker)
      this._t.is(data.code, 'KRW-BTC')
    } else {
      this._t.is(this._td.length, 10)
      this._td.reduce((p, c) => {
        if(p !== null) {
          this._t.true(p.trade_timestamp <= c.trade_timestamp)
        }
        return c
      }, null)
      this._t.end()
    }
  }

  finish = null
  onOrderbook = null
  onTrade = null
}



class TestQueueBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _count = 3
  private _datas: I.TradeType[] = []

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    t.plan(7)
  }

  async start() {
    this._t.pass()
  }
  
  async onTrade(data: I.TradeType) {
    if(this._count === -1) {
      const t = this._t
      //console.log(`data.length: ${this._datas.length}`)
      this._datas.reduce((p, d) => {
        //console.log(d)
        if(p) {
          t.true(p.trade_timestamp <= d.trade_timestamp)
          t.true(p.sequential_id < d.sequential_id)
        }
        return d
      }, null)
      this._t.end()
      return
    }
    const ms = this._count-- * 1000
    await $4.stop(ms)
    this.log(`count: ${this._count}`, data)
    this._datas.push(data)
  }

  finish = null
  onOrderbook = null
  onTicker = null
}



class TestCandleQueueBot extends BaseSocketBot {
  private count = 3
  private tr: I.TradeType

  constructor(code: string, private readonly t: CbExecutionContext) {
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
      this.t.end()
      return
    }
    await $4.stop(1000)
    // console.log(ohlc)
    // console.log(this.tr)
    this.t.true(ohlc[0].close === this.tr.trade_price)
  }

  finish = null
  onOrderbook = null
  onTicker = null
}



class TestLatestBot extends BaseSocketBot {
  private _t: CbExecutionContext

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    t.plan(4)
  }

  async start() {
    this._t.pass()
  }

  async onTrade(res: I.TradeType) {
    this._t.true(this.latest(I.ReqType.Trade) !== null)
    this._t.true(this.latest(I.ReqType.Orderbook) !== null)
    this._t.true(this.latest(I.ReqType.Ticker) === null)
    this._t.end()
  }

  async onOrderbook(res: I.OrderbookType) {
    this._t.true(this.latest(I.ReqType.Trade) !== null)
    this._t.true(this.latest(I.ReqType.Orderbook) !== null)
    this._t.true(this.latest(I.ReqType.Ticker) === null)
    this._t.end()
  }
  
  finish = null
  onTicker = null
}



class TestLogBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _origin
  private socket: BaseUPbitSocket

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(2)
  }
  
  async start(socket: BaseUPbitSocket) {
    this.socket = socket
    this._origin = TestLogBot.writer
    TestLogBot.writer = new $4.FileWriter(join(__dirname, 'log', 'test.log'), '1d')
    this._t.pass()
  }

  async onTrade(data: I.TradeType) {
    this.log('Hello World!!')
    await $4.stop(500)
    const contents = await readFile(join(__dirname, 'log', 'test.log'))
    const reg = /log: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} > TestLogBot:KRW-BTC - Hello World!!/
    this._t.regex(contents.toString(), reg)
    TestLogBot.writer = this._origin
    this._t.end()
    await this.socket.close()
  }

  onOrderbook = null
  onTicker = null
  finish = null
}



class IdBot extends BaseSocketBot {
  constructor(code: string, public readonly id: number) {
    super(code)
  }

  get name() {
    return super.name + ':' + this.id
  }

  onTrade(tr: I.TradeType): Promise<void> {
    return
  }

  onOrderbook = null
  onTicker = null
  start = null
  finish = null
}



test.after(() => remove(join(__dirname, 'log')))