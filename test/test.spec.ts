import test, {
  CbExecutionContext,
} from 'ava'
import WebSocket from 'ws'
import {
  UPbitSocket,
  BaseSocketBot,
  types as I,
} from '../src'
import $4 from 'fourdollar'
import {
  join,
} from 'path'
import {
  readFile,
} from 'fs/promises'
import {
  remove,
} from 'fs-extra'



class TestBot extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async init() {
  }

  async onTrade(data: I.TradeType) {
  }

  onOrderbook = null
  onTicker = null
}


class TestBot2 extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async init() {
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  onTicker = null
}

class TestBot3 extends BaseSocketBot {
  constructor(code: string) {
    super(code)
  }

  async init() {
  }

  async onTrade(data: I.TradeType) {
  }

  async onOrderbook(data: I.OrderbookType) {
  }

  onTicker = null
}


class TestTradeBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _td: I.TradeType[] = []

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(50)
  }

  async init() {
    this._t.pass()
  }

  async onTrade(data: I.TradeType) {
    if(this._td.length < 10) {
      this._td.push(data)
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
      this._t.is(this._td.length, 10)
      this._td.reduce((p, c) => {
        if(p !== null) {
          this._t.true(p.trade_timestamp <= c.trade_timestamp)
          this._t.true(p.sequential_id < c.sequential_id)
        }
        return c
      }, null)
      this._t.end()
    }
  }

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

  async init() {
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

  async init() {
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

  async init() {
    this._t.pass()
  }
  
  onTicker = null
  onOrderbook = null

  async onTrade(data: I.TradeType) {
    const ms = this._count-- * 2000
    this._datas.push(data)
    this.log(`count: ${this._count}`, data)
    await $4.stop(ms)
    if(ms === 0) {
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
    }
  }
}


class TestLogBot extends BaseSocketBot {
  private _t: CbExecutionContext
  private _origin

  constructor(code: string, t: CbExecutionContext) {
    super(code)
    this._t = t
    this._t.plan(2)
  }
  
  async init() {
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
  }

  onOrderbook = null
  onTicker = null
}


test.cb.skip('websocket > trade', t => {
  const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
  ws.onopen = e => {
    console.log('opened...')
    ws.send(JSON.stringify([
      {ticket: 'test'},
      {type: 'trade', codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-NEO',
        'KRW-MTL',
        'KRW-LTC',
        'KRW-XRP',
        'KRW-ETC',
        'KRW-OMG',
        'KRW-SNT',
        'KRW-WAVES',
      ], isOnlyRealtime: true},
    ]))
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})

test.cb.skip('websocket > orderbook', t => {
  const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
  ws.onopen = e => {
    console.log('opened...')
    ws.send(JSON.stringify([
      {ticket: 'test'},
      {type: 'orderbook', codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-NEO',
        'KRW-MTL',
        'KRW-LTC',
        'KRW-XRP',
        'KRW-ETC',
        'KRW-OMG',
        'KRW-SNT',
        'KRW-WAVES',
      ], isOnlyRealtime: true},
    ]))
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})

test.cb.skip('websocket > ticker', t => {
  const ws = new WebSocket('wss://api.upbit.com/websocket/v1')
  ws.onopen = e => {
    console.log('opened...')
    ws.send(JSON.stringify([
      {ticket: 'test'},
      {type: 'ticker', codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-NEO',
        'KRW-MTL',
        'KRW-LTC',
        'KRW-XRP',
        'KRW-ETC',
        'KRW-OMG',
        'KRW-SNT',
        'KRW-WAVES',
      ], isOnlyRealtime: true},
    ]))
  }
  ws.onmessage = e => {
    //console.log(`message: ${e.data}`)
    //console.log(JSON.stringify(e.data, null, 2))
    console.log('')
    console.log('------------------------------------------------------------')
    console.log(JSON.parse(e.data.toString('utf-8')))
  }
  ws.onerror = e => {
    console.log(`error: ${e}`)
  }
  ws.onclose = e => {
    console.log('closed...')
    t.end()
  }
})

test('BaseSocketBot > id', t => {
  const bot = new TestBot('KRW-BTC')
  t.is(bot.name, 'TestBot:KRW-BTC')
  t.pass()
})

test.serial('UPbitSocket > #start() & #close()', async t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  t.is(us.state, I.SocketState.NotCreated)
  await us.start()
  t.is(us.state, I.SocketState.Open)
  await us.close()
  t.is(us.state, I.SocketState.Closed)
})

test('UPbitSocket > add bot & get bot', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  us.addBotClass(TestBot)
  const bots = us.getBots(I.ReqType.Trade)
  t.is(bots.length, 10)
  t.deepEqual(bots.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot:KRW-ETH',
    'TestBot:KRW-NEO',
    'TestBot:KRW-MTL',
    'TestBot:KRW-LTC',
    'TestBot:KRW-XRP',
    'TestBot:KRW-ETC',
    'TestBot:KRW-OMG',
    'TestBot:KRW-SNT',
    'TestBot:KRW-WAVES',
  ])
  us.addBotClass(TestBot2)
  const b2 = us.getBots(I.ReqType.Trade)
  t.is(b2.length, 20)
  t.deepEqual(b2.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot:KRW-ETH',
    'TestBot:KRW-NEO',
    'TestBot:KRW-MTL',
    'TestBot:KRW-LTC',
    'TestBot:KRW-XRP',
    'TestBot:KRW-ETC',
    'TestBot:KRW-OMG',
    'TestBot:KRW-SNT',
    'TestBot:KRW-WAVES',
    'TestBot2:KRW-BTC',
    'TestBot2:KRW-ETH',
    'TestBot2:KRW-NEO',
    'TestBot2:KRW-MTL',
    'TestBot2:KRW-LTC',
    'TestBot2:KRW-XRP',
    'TestBot2:KRW-ETC',
    'TestBot2:KRW-OMG',
    'TestBot2:KRW-SNT',
    'TestBot2:KRW-WAVES',
  ])
  us.addBot(new TestBot3('KRW-BTC'))
  const b3 = us.getBots(I.ReqType.Trade, 'KRW-BTC')
  t.is(b3.length, 3)
  t.deepEqual(b3.map(b => b.name), [
    'TestBot:KRW-BTC',
    'TestBot2:KRW-BTC',
    'TestBot3:KRW-BTC',
  ])
  const b4 = us.getBots(I.ReqType.Orderbook, 'KRW-XRP')
  t.is(b4.length, 1)
  t.deepEqual(b4.map(b => b.name), [
    'TestBot2:KRW-XRP',
  ])
  const b5 = us.getBots(I.ReqType.Ticker)
  t.is(b5.length, 0)
})

test('UPbitSocket > throw #addBot()', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  us.addBotClass(TestBot)
  const err1 = t.throws(() => {
    us.addBot(new TestBot('KRW-BTC'))
  })
  t.is(err1.message, "'TestBot:KRW-BTC' already exists.")
  const err2 = t.throws(() => {
    us.addBot(new TestBot('XXX-XXX'))
  })
  t.is(err2.message, "'XXX-XXX' is not service.")
})

test('UPbitSocket > #requests()', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-XRP',
  ])
  us.addBotClass(TestBot)
  us.addBotClass(TestBot2)
  const req = us.requests()
  t.deepEqual(req, [
    {ticket: us.uuid},
    {
      type: 'trade',
      codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-XRP',
      ],
      isOnlyRealtime: true,
    },
    {
      type: 'orderbook',
      codes: [
        'KRW-BTC',
        'KRW-ETH',
        'KRW-XRP',
      ],
      isOnlyRealtime: true,
    },
  ])
})

test.serial.cb('TestTradeBot', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  us.addBot(new TestTradeBot('KRW-BTC', t))
  us.start()
})

test.serial.cb('TestOrderbookBot', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  us.addBot(new TestOrderbookBot('KRW-BTC', t))
  us.start()
})

test.serial.cb('TestTickerBot', t => {
  const us = new UPbitSocket([
    'KRW-BTC',
    'KRW-ETH',
    'KRW-NEO',
    'KRW-MTL',
    'KRW-LTC',
    'KRW-XRP',
    'KRW-ETC',
    'KRW-OMG',
    'KRW-SNT',
    'KRW-WAVES',
  ])
  us.addBot(new TestTickerBot('KRW-BTC', t))
  us.start()
})

test.serial.cb('TestLogBot', t => {
  const us = new UPbitSocket(['KRW-BTC'])
  us.addBot(new TestLogBot('KRW-BTC', t))
  us.start()
})

test.serial.cb('TestQueueBot', t => {
  t.timeout(20000)
  const us = new UPbitSocket(['KRW-BTC'])
  us.addBot(new TestQueueBot('KRW-BTC', t))
  us.start()
})

// test.after(() => remove(join(__dirname, 'log')))