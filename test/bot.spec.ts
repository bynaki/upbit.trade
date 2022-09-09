import test, {
  ExecutionContext,
} from 'ava'
import {
  UPbitSocket,
  BaseBot,
  types as I,
  BaseUPbitSocket,
  subscribe,
} from '../src'
import {
  logger,
  stop,
} from 'fourdollar'
import {
  join,
} from 'path'
import {
  readFile,
} from 'fs/promises'
import {
  removeSync,
} from 'fs-extra'
import {
  Observable,
  types as If,
} from 'fourdollar'



test.serial('Bot#name', t => {
  const bot = new TestBot('KRW-BTC')
  t.is(bot.name, 'TestBot:KRW-BTC')
})

test.serial('UPbitSocket#open() & UPbitSocket#close()', async t => {
  const us = new UPbitSocket()
  t.is(us.state, I.SocketState.Closed)
  await us.open()
  t.is(us.state, I.SocketState.Open)
  await us.close()
  t.is(us.state, I.SocketState.Closed)
})

test.serial('UPbitSocket#addBot(): 이름이 같으면 추가되지 않는다.', t => {
  const us = new UPbitSocket()
  us.addBot(new TestBot('KRW-BTC'))
  us.addBot(new TestBot('KRW-BTC'))
  t.is(us.getBots().length, 1)
})

test.serial('UPbitSocket#addBot(): 같은 클래스라도 이름이 다르면 추가된다.', t => {
  const us = new UPbitSocket()
  us.addBot(new IdBot('KRW-BTC', 1))
  us.addBot(new IdBot('KRW-BTC', 2))
  t.is(us.getBots().length, 2)
  t.is(us.getBots()[0].name, 'IdBot:KRW-BTC:1')
  t.is(us.getBots()[1].name, 'IdBot:KRW-BTC:2')
  us.addBot(new IdBot('KRW-BTC', 3), new IdBot('KRW-BTC', 4))
  t.is(us.getBots().length, 4)
  t.is(us.getBots()[2].name, 'IdBot:KRW-BTC:3')
  t.is(us.getBots()[3].name, 'IdBot:KRW-BTC:4')
})

test.serial('UPbitSocket#addBot(): 여러개 추가할 수 있다.', t => {
  const us = new UPbitSocket()
  us.addBot(...[new IdBot('KRW-BTC', 1), new IdBot('KRW-BTC', 2)])
  us.addBot(new TestBot('KRW-BTC'), new TestBot('KRW-ETH'))
  t.is(us.getBots().length, 4)
})

test.serial('UPbitSocket#addBotClass(): 클래스 단위로 추가할 수 있다.', t => {
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

test.serial('UPbitSocket#addBot() & UPbitSocket#getBots()', t => {
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

test.only('UPbitSocket#requests()', t => {
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
  console.log(req)
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

test.serial('test trade', async t => {
  const us = new UPbitSocket()
  us.addBot(new TestTradeBot('KRW-BTC', t))
  await us.open(1000)
})

test.serial('test orderbook', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestOrderbookBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('test ticker', async t => {
  const us = new UPbitSocket()
  us.addBot(new TestTickerBot('KRW-BTC', t))
  await us.open(1000)
})

test.serial('test log', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestLogBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('test queue', async t => {
  t.plan(6)
  const us = new UPbitSocket()
  const test = new Test('KRW-BTC')
  const trs: I.TradeType[] = []
  const obs = test.observer(I.EventType.Trade)
  const sub1: {[name: string]: any} = ({
    count: 0,
    delay: [100, 300, 600, 200, 400],
    start(sub: If.Subscription) {
      sub1.sub = sub
    },
    async next(tr: I.TradeType) {
      await stop(sub1.delay[sub1.count++])
      trs.push(tr)
      if(sub1.count === 5) {
        sub1.sub.unsubscribe()
      }
      if(trs.length === 10) {
        us.close()
      }
    },
  })
  const sub2: {[name: string]: any} = ({
    count: 0,
    delay: [600, 100, 300, 100, 200],
    start(sub: If.Subscription) {
      sub2.sub = sub
    },
    async next(tr: I.TradeType) {
      await stop(sub2.delay[sub2.count++])
      trs.push(tr)
      if(sub2.count === 5) {
        sub2.sub.unsubscribe()
      }
      if(trs.length === 10) {
        us.close()
      }
    },
  })
  obs.subscribe(sub1)
  obs.subscribe(sub2)
  test.observer(I.EventType.Finish).subscribe({
    next() {
      t.is(trs.length, 10)
      t.is(trs[0], trs[1])
      t.is(trs[2], trs[3])
      t.is(trs[4], trs[5])
      t.is(trs[6], trs[7])
      t.is(trs[8], trs[9])
    },
  })
  us.addBot(test)
  await us.open(1000)
})


test.serial('test candle queue', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestCandleQueueBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('test latest', t => {
  const us = new UPbitSocket()
  return new Observable(obs => {
    us.addBot(new TestLatestBot('KRW-BTC', t, obs))
    us.open()
  })
})

test.serial('test event decorator', t => {
  t.plan(2)
  const socket = new UPbitSocket()
  return new Observable(obs => {
    socket.addBot(new TestSub1('KRW-BTC', t, obs))
    socket.open()
  })
})

test.serial('test event decorator: inherit', t => {
  t.plan(6)
  const socket = new UPbitSocket()
  return new Observable(obs => {
    socket.addBot(new TestSub2('KRW-BTC', t, obs))
    socket.open()
  })
})

test.serial('Bot#Observer()', t => {
  t.plan(3)
  const socket = new UPbitSocket()
  const test = new Test('KRW-BTC')
  return new Observable(obs => {
    const start = test.observer(I.EventType.Start)
    start.subscribe({
      next(socket: UPbitSocket) {
        t.pass()
      }
    })
    const trade = test.observer(I.EventType.Trade)
    trade.subscribe({
      async next(tr: I.TradeType) {
        console.log(tr)
        t.pass()
        await socket.close()
      }
    })
    const finish = test.observer(I.EventType.Finish)
    finish.subscribe({
      next() {
        t.pass()
        obs.complete()
      }
    })
    socket.addBot(test)
    socket.open()
  })
})

test.serial('test unsubscribe', t => {
  t.plan(4)
  const socket = new UPbitSocket()
  return new Observable(s => {
    const test = new Test('KRW-BTC')
    const o = test.observer(I.EventType.Trade)
    let c1 = 0
    let c2 = 0
    const sub1 = o.subscribe({
      async next(tr: I.TradeType) {
        c1++
        await stop(1000)
        sub1.unsubscribe()
      }
    })
    const sub2 = o.subscribe({
      next(tr: I.TradeType) {
        t.is(c1, 1)
        if(++c2 === 4) {
          sub2.unsubscribe()
          s.complete()
        }
      }
    })
    socket.addBot(test)
    socket.open()
    return () => {
      console.log('closed!!')
    }
  })
})


test.serial('Bot#subscribe()', t => {
  t.plan(11)
  const socket = new UPbitSocket()
  return new Observable(obs => {
    const test = new Test('KRW-BTC')
    let data: {
      start?: UPbitSocket
      trade?: I.TradeType
      orderbook?: I.OrderbookType
      ticker?: I.TickerType
      ohlcs?: I.OHLCType[]
    } = {}
    const start = test.subscribe(I.EventType.Start, {
      next(socket: UPbitSocket) {
        data.start = socket
        t.pass()
        start.unsubscribe()
        assert()
      }
    })
    const trade = test.subscribe(I.EventType.Trade, {
      next(tr: I.TradeType) {
        data.trade = tr
        t.pass()
        trade.unsubscribe()
        assert()
      }
    })
    const orderbook = test.subscribe(I.EventType.Orderbook, {
      next(ob: I.OrderbookType) {
        data.orderbook = ob
        t.pass()
        orderbook.unsubscribe()
        assert()
      }
    })
    const ticker = test.subscribe(I.EventType.Ticker, {
      next(tk: I.TickerType) {
        data.ticker = tk
        t.pass()
        ticker.unsubscribe()
        assert()
      }
    })
    const candle = test.subscribe(I.EventType.Candle, {min: 1, limit: 10}, {
      next(ohlcs: I.OHLCType[]) {
        data.ohlcs = ohlcs
        t.pass()
        candle.unsubscribe()
        assert()
      }
    })
    const finish = test.subscribe(I.EventType.Finish, {
      next() {
        console.log('finish')
        t.deepEqual(Object.keys(data.trade as any), [
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
        t.deepEqual(Object.keys(data.orderbook!), [
          'type',
          'code',
          'timestamp',
          'total_ask_size',
          'total_bid_size',
          'orderbook_units',
          'stream_type',
        ])
        t.is(data.orderbook!.orderbook_units.length, 15)
        t.deepEqual(Object.keys(data.orderbook!.orderbook_units[0]), [
          'ask_price',
          'bid_price',
          'ask_size',
          'bid_size',
        ])
        t.deepEqual(Object.keys(data.ticker!).sort(), [
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
        t.deepEqual(Object.keys(data.ohlcs![0]).sort(), [
          'open',
          'high',
          'low',
          'close',
          'volume',
          'timestamp',
        ].sort())
        obs.complete()
      }
    })
    const assert = () => {
      if(data.start && data.trade && data.orderbook && data.ticker && data.ohlcs) {
        socket.close()
      }
    }
    socket.addBot(test)
    socket.open()
    return () => {
      console.log('closed!!')
    }
  })
})



test.before(() => {
  removeSync(join(__dirname, 'test-bot.db'))
  removeSync(join(__dirname, 'log'))
})



class TestBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  @subscribe.trade
  onTrade(tr: I.TradeType) {
  }
}



class TestBot2 extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  @subscribe.trade
  onTrade(data: I.TradeType) {
  }

  @subscribe.orderbook
  onOrderbook(data: I.OrderbookType) {
  }
}

class TestBot3 extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  @subscribe.trade
  async onTrade(data: I.TradeType) {
  }

  @subscribe.orderbook
  async onOrderbook(data: I.OrderbookType) {
  }
}

class TestTradeBot extends BaseBot {
  trs: I.TradeType[] = []
  socket: UPbitSocket

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs?: If.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(50)
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.socket = socket
    this.t.pass()
  }

  @subscribe.trade
  async onTrade(data: I.TradeType) {
    if(this.trs.length < 10) {
      this.trs.push(data)
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
      this.t.is(this.trs.length, 10)
      this.trs.reduce((p, c) => {
        if(p) {
          this.t.true(p.trade_timestamp <= c.trade_timestamp)
          this.t.true(p.sequential_id < c.sequential_id)
        }
        return c
      })
      this.socket.close()
      this.obs?.complete()
    }
  }
}



class TestOrderbookBot extends BaseBot {
  tds: I.OrderbookType[] = []
  socket: UPbitSocket

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs?: If.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(61)
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.socket = socket
    this.t.pass()
  }

  @subscribe.orderbook
  async onOrderbook(data: I.OrderbookType) {
    if(this.tds.length < 10) {
      this.tds.push(data)
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
      this.t.is(this.tds.length, 10)
      this.tds.reduce((p, c) => {
        if(p) {
          this.t.true(p.timestamp < c.timestamp)
        }
        return c
      })
      this.socket.close()
      this.obs?.complete()
    }
  }
}



class TestTickerBot extends BaseBot {
  tds: I.TickerType[] = []
  socket: UPbitSocket

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs?: If.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(41)
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.socket = socket
    this.t.pass()
  }

  @subscribe.ticker
  async onTicker(data: I.TickerType) {
    if(this.tds.length < 10) {
      this.tds.push(data)
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
      this.t.is(this.tds.length, 10)
      this.tds.reduce((p, c) => {
        if(p) {
          this.t.true(p.trade_timestamp <= c.trade_timestamp)
        }
        return c
      })
      this.socket.close()
      this.obs?.complete()
    }
  }
}



// class TestQueueBot extends BaseBot {
//   private _count = 3
//   private _datas: I.TradeType[] = []
//   private completed = false

//   constructor(code: string, private readonly t: ExecutionContext
//     , private readonly obs: If.SubscriptionObserver<void>) {
//     super(code)
//     t.plan(7)
//   }

//   @logger()
//   log(msg: any) {
//     return msg
//   }

//   @subscribe.start
//   async start(socket) {
//     this.t.pass()
//   }
  
//   @subscribe.trade
//   async onTrade(data: I.TradeType) {
//     if(this.completed) {
//       return
//     }
//     this.log(`count: ${this._count}`)
//     console.log(data)
//     if(this._count === -1) {
//       const t = this.t
//       // console.log(`data.length: ${this._datas.length}`)
//       this._datas.reduce((p, d) => {
//         if(p) {
//           t.true(p.trade_timestamp <= d.trade_timestamp)
//           t.true(p.sequential_id < d.sequential_id)
//         }
//         return d
//       })
//       this.completed = true
//       this.obs.complete()
//       return
//     }
//     const ms = this._count-- * 1000
//     await stop(ms)
//     this._datas.push(data)
//   }
// }



class TestCandleQueueBot extends BaseBot {
  private count = 3
  private tr: I.TradeType

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: If.SubscriptionObserver<void>) {
    super(code)
    t.plan(3)
  }

  @subscribe.start
  async start(socket) {
    this.t.pass()
  }
  
  @subscribe.trade
  async onTrade(tr: I.TradeType) {
    this.tr = tr
  }

  @subscribe.candle(1, 10)
  async m1(ohlc: I.OHLCType[]) {
    if(--this.count <= 0) {
      this.obs.complete()
      return
    }
    await stop(1000)
    // console.log(ohlc)
    // console.log(this.tr)
    this.t.true(ohlc[0].close === this.tr.trade_price)
  }
}



class TestLatestBot extends BaseBot {
  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs: If.SubscriptionObserver<void>) {
    super(code)
    t.plan(4)
  }

  @subscribe.start
  async start(socket) {
    this.t.pass()
  }

  @subscribe.trade
  async onTrade(res: I.TradeType) {
    this.t.true(this.latest(I.ReqType.Trade) !== null)
    this.t.true(this.latest(I.ReqType.Orderbook) !== null)
    this.t.true(this.latest(I.ReqType.Ticker) === null)
    this.obs.complete()
  }

  @subscribe.orderbook
  async onOrderbook(res: I.OrderbookType) {
    this.t.true(this.latest(I.ReqType.Trade) !== null)
    this.t.true(this.latest(I.ReqType.Orderbook) !== null)
    this.t.true(this.latest(I.ReqType.Ticker) === null)
    this.obs.complete()
  }
}



class TestLogBot extends BaseBot {
  socket: UPbitSocket

  constructor(code: string, private readonly t: ExecutionContext
    , private readonly obs?: If.SubscriptionObserver<void>) {
    super(code)
    this.t.plan(2)
  }

  @logger(join(__dirname, 'log', 'test.log'), '1d')
  log(msg: string) {
    return msg
  }
  
  @subscribe.start
  async start(socket: UPbitSocket) {
    this.socket = socket
    this.t.pass()
  }

  @subscribe.trade
  async onTrade(data: I.TradeType) {
    this.log('Hello World!!')
    await stop(500)
    const contents = await readFile(join(__dirname, 'log', 'test.log'))
    this.t.is(contents.toString(), '\n"Hello World!!"')
    this.socket.close()
    this.obs?.complete()
  }
}



class IdBot extends BaseBot {
  constructor(code: string, public readonly id: number) {
    super(code)
  }

  get name() {
    return super.name + ':' + this.id
  }

  @subscribe.trade
  trade(tr: I.TradeType) {}
}


class TestSub1 extends BaseBot {
  hasStart = false
  hasTrade = false

  constructor(code: string, private readonly t: ExecutionContext, private readonly obs: If.SubscriptionObserver<void>) {
    super(code)
    this.t.deepEqual(this._preSubs, {
      start: {
        type: 'start',
        opts: undefined,
      },
      onTrade: {
        type: 'trade',
        opts: undefined,
      },
    })
  }

  @subscribe.start
  start(socket?: BaseUPbitSocket) {
    this.hasStart = true
    if(this.hasStart && this.hasTrade) {
      this.t.pass()
      this.obs.complete()
    }
  }

  @subscribe.trade
  onTrade(tr: I.TradeType) {
    this.hasTrade = true
    if(this.hasStart && this.hasTrade) {
      this.t.pass()
      this.obs.complete()
    }
  }
}



class TestParent extends BaseBot {
  hasOrderbook = false

  constructor(name: string, protected t: ExecutionContext, protected obs: If.SubscriptionObserver<void>) {
    super(name)
    this.t.deepEqual(this._preSubs, {
      onTrade: {
        type: 'trade',
        opts: undefined,
      },
      onCandle: {
        type: 'candle',
        opts: {min: 1, limit: 1},
      },
      onOrderbook: {
        type: 'orderbook',
        opts: undefined,
      },
      onTrade2: {
        type: 'trade',
        opts: undefined,
      },
    })
  }

  @subscribe.trade
  onTrade(tr: I.TradeType) {
    this.t.fail()
  }

  @subscribe.candle(5, 10)
  onCandle(ohlcs: I.OHLCType[]) {
    this.t.fail()
  }

  @subscribe.orderbook
  onOrderbook(ob: I.OrderbookType) {
    if(!this.hasOrderbook) {
      console.log('orderbook ----------------')
      console.log(JSON.stringify(ob, null, 2))
      this.hasOrderbook = true
      this.t.pass()
    }
  }
}

class TestSub2 extends TestParent {
  hasCandle = false
  hasTrade = false
  hasTrade2 = false

  constructor(name: string, t: ExecutionContext, obs: If.SubscriptionObserver<void>) {
    super(name, t, obs)
    this.t.deepEqual(this._preSubs, {
      onTrade: {
        type: 'trade',
        opts: undefined,
      },
      onCandle: {
        type: 'candle',
        opts: {min: 1, limit: 1},
      },
      onOrderbook: {
        type: 'orderbook',
        opts: undefined,
      },
      onTrade2: {
        type: 'trade',
        opts: undefined,
      },
    })
  }

  @subscribe.candle(1, 1)
  onCandle(ohlcs: I.OHLCType[]) {
    if(!this.hasCandle) {
      console.log('candle -----------------')
      console.log(JSON.stringify(ohlcs, null, 2))
      this.t.pass()
      this.hasCandle = true
    }
    if(this.hasTrade && this.hasCandle && this.hasOrderbook && this.hasTrade2) {
      this.obs.complete()
    }
  }

  @subscribe.trade
  onTrade(tr: I.TradeType) {
    if(!this.hasTrade) {
      console.log('onTrade --------------------')
      console.log(JSON.stringify(tr, null, 2))
      this.t.pass()
      this.hasTrade = true
    }
    if(this.hasTrade && this.hasCandle && this.hasOrderbook && this.hasTrade2) {
      this.obs.complete()
    }
  }

  @subscribe.trade
  onTrade2(tr: I.TradeType) {
    if(!this.hasTrade2) {
      console.log('onTrade2 --------------------')
      console.log(JSON.stringify(tr, null, 2))
      this.t.pass()
      this.hasTrade2 = true
    }
    if(this.hasTrade && this.hasCandle && this.hasOrderbook && this.hasTrade2) {
      this.obs.complete()
    }
  }
}



class Test extends BaseBot {
  constructor(name: string) {
    super(name)
  }
}
