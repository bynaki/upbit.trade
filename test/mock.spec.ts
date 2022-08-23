import test, {
  ExecutionContext,
} from 'ava'
import {
  BaseBot,
  types as I,
  UPbitTradeMock,
  UPbitSequence,
  getConfig,
  UPbitCandleMock,
  subscribe,
  UPbitSocket,
} from '../src'
import {
  join,
} from 'path'
import {
  removeSync,
} from 'fs-extra'
import {
  format
} from 'fecha'
import {
  logger, MemoryWriter,
} from 'fourdollar'




class TestErrorBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  @subscribe.ticker
  async onTicker(tick: I.TickerType): Promise<void> {}
  @subscribe.orderbook
  async onOrderbook(ord: I.OrderbookType): Promise<void> {}
}


const writer = new MemoryWriter()


class TestTradeBot extends BaseBot {
  public pre: I.TradeType
  public count = 0

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.start
  async start(socket: UPbitSocket) {
    this.log('started')
  }

  @subscribe.finish
  async finish() {
    this.log('finished')
  }

  @subscribe.trade
  async onTrade(tr: I.TradeType) {
    this.log(this.name)
    this.log(tr.sequential_id)
    this.log(tr.trade_time)
    this.log(Object.keys(tr))
  }
}



// class TestOrderBot extends BaseBot {
//   private order: OrderMarket
//   private status: I.OrderType

//   constructor(code: string, private readonly t: ExecutionContext) {
//     super(code)
//     t.plan(28)
//   }

//   async start() {
//     this.order = this.newOrderMarket()
//     const error = this.t.throws(() => this.newOrder())
//     this.t.is(error!.message, "'UPbitTradeMock' 모드에서는 'newOrder()'를 지원하지 않는다.")
//   }

//   async finish() {
//     // console.log(this.order.history)
//   }

//   async onTrade(tr: I.TradeType) {
//     if(this.status?.side === 'ask' && this.status?.state === 'done') {
//       return
//     }
//     if(!await this.order.updateStatus()) {
//       this.status = await this.order.bid(10000)
//       const status = this.status
//       // console.log(status)
//       this.t.is(status.side, 'bid')
//       this.t.is(status.ord_type, 'price')
//       this.t.is(status.price, 10000)
//       this.t.is(status.state, 'wait')
//       this.t.is(status.market, 'KRW-BTC')
//       this.t.is(status.executed_volume, 0)
//       this.t.is(status.trades_count, 0)
//       return
//     }
//     const updated = await this.order.updateStatus()
//     if(updated.side === 'bid' && updated.state === 'cancel') {
//       // console.log(updated)
//       this.t.is(updated.uuid, this.status!.uuid)
//       this.t.is(updated.state, 'cancel')
//       this.t.true(updated.executed_volume !== 0)
//       this.t.is(updated.trades_count, 1)
//       this.t.is(updated.trades.length, 1)
//       this.t.is(updated.trades[0].funds, 10000)
//       this.status = await this.order.ask()
//       const status = this.status
//       // console.log(status)
//       this.t.is(status.side, 'ask')
//       this.t.is(status.ord_type, 'market')
//       this.t.is(status.price, null!)
//       this.t.is(status.state, 'wait')
//       this.t.true(status.volume !== null)
//       this.t.is(status.market, 'KRW-BTC')
//       this.t.is(status.executed_volume, 0)
//       this.t.is(status.trades_count, 0)
//       return
//     }
//     if(updated.side === 'ask' && updated.state === 'done') {
//       // console.log(updated)
//       this.t.is(updated.uuid, this.status!.uuid)
//       this.t.is(updated.state, 'done')
//       this.t.true(updated.executed_volume !== 0)
//       this.t.is(updated.trades_count, 1)
//       this.t.is(updated.trades.length, 1)
//       this.status = updated
//       return
//     }
//   }

//   onOrderbook = null!
//   onTicker = null!
// }



class TestTradeCandleBot extends BaseBot {
  t: ExecutionContext
  ohlcs: I.OHLCType[] = []
  done = false

  constructor(code: string) {
    super(code)
  }

  setTestObject(t: ExecutionContext) {
    this.t = t
    t.plan(4)
  }
  
  @subscribe.candle(1, 10)
  async onCandle1m(ohlcs: I.OHLCType[]) {
    if(ohlcs.length === 3 && this.done === false) {
      const rev = ohlcs.reverse()
      const api = new UPbitSequence(getConfig().upbit_keys)
      const cc = (await api.allCandlesMinutes(1, {
        market: 'KRW-BTC',
        from: format(new Date(rev[0].timestamp), 'isoDateTime'),
        to: format(new Date(rev[2].timestamp), 'isoDateTime'),
      })).reverse()
      rev[0].volume = Math.floor(rev[0].volume * 10000) / 10000
      rev[1].volume = Math.floor(rev[1].volume * 10000) / 10000
      this.t.deepEqual(rev[0], {
        open: cc[0].opening_price,
        high: cc[0].high_price,
        low: cc[0].low_price,
        close: cc[0].trade_price,
        volume: Math.floor(cc[0].candle_acc_trade_volume * 10000) / 10000,
        timestamp: new Date(cc[0].candle_date_time_utc + '+00:00').getTime(),
      })
      this.t.deepEqual(rev[1], {
        open: cc[1].opening_price,
        high: cc[1].high_price,
        low: cc[1].low_price,
        close: cc[1].trade_price,
        volume: Math.floor(cc[1].candle_acc_trade_volume * 10000) / 10000,
        timestamp: new Date(cc[1].candle_date_time_utc + '+00:00').getTime(),
      })
      this.done = true
    }
  }

  @subscribe.start
  async start(socket: UPbitSocket): Promise<void> {
    this.t.pass()
    return
  }

  @subscribe.finish
  async finish(): Promise<void> {
    this.t.pass()
    return
  }
}




class TestCandleBot extends BaseBot {
  // t: ExecutionContext
  ohlcs: I.OHLCType[] = []

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  // setTestObject(t: ExecutionContext) {
  //   this.t = t
  //   t.plan(14)
  // }
  
  // @subscribe.candle(10, 10)
  // async onCandle10m(ohlcs: I.OHLCType[]) {
  //   const from = '2021-09-13T00:00:00+00:00'
  //   const to = '2021-09-13T01:40:00+00:00'
  //   if(ohlcs.length === 10) {
  //     const api = new UPbitSequence(getConfig().upbit_keys)
  //     const cc = (await api.allCandlesMinutes(10, {
  //       market: this.code,
  //       from,
  //       to,
  //     }))
  //     ohlcs.forEach((o, i) => {
  //       this.t.deepEqual(o, {
  //         open: cc[i].opening_price,
  //         high: cc[i].high_price,
  //         low: cc[i].low_price,
  //         close: cc[i].trade_price,
  //         volume: cc[i].candle_acc_trade_volume,
  //         timestamp: new Date(cc[i].candle_date_time_utc + '+00:00').getTime(),
  //       })
  //     })
  //     this.t.is(ohlcs[ohlcs.length - 1].timestamp, new Date(from).getTime())
  //     this.t.is(ohlcs[0].timestamp, new Date(to).getTime() - (1000 * 60 * 10))
  //   }
  // }

  @subscribe.candle(10, 10)
  async onCandle10m(ohlcs: I.OHLCType[]) {
    const from = '2021-09-13T00:00:00+00:00'
    const to = '2021-09-13T01:40:00+00:00'
    this.log(ohlcs[0])
  }

  @subscribe.start
  async start(socket: UPbitSocket): Promise<void> {
    this.log('started')
    return
  }

  @subscribe.finish
  async finish(): Promise<void> {
    this.log('finished')
    return
  }
}



const codes = [
  "KRW-BTC",
  "KRW-ETH",
  // "KRW-NEO",
  // "KRW-MTL",
]

test.before(() => {
  removeSync(join(__dirname, 'test-mock.db'))
})



test.serial('intro', async t => {
  const api = new UPbitSequence(getConfig('./config.json').upbit_keys)
  const trs = await api.allTradesTicks({
    market: 'KRW-BTC',
    daysAgo: 0,
    to: '00:00:10'
  })
  console.log(trs[0])
  t.pass()
})




test.serial('UPbitTradeMock: mock 모드에서는 tiker와 orderbook을 제공하지 않는다.', async t => {
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade', {
    daysAgo: 0,
    to: '00:00:10',
  })
  mock.addBotClass(TestErrorBot, [
    'KRW-BTC',
    'KRW-ETH',
  ])
  const bots = mock.getBots()
  t.is(bots[0].name, 'TestErrorBot:KRW-BTC')
  t.is(bots[1].name, 'TestErrorBot:KRW-ETH')
  try {
    await mock.open()
  } catch(e) {
    t.is(e.message, '"mock" 모드에서는 "ticker" 를 제공하지 않는다.')
  }
})

test.serial('UPbitTradeMock', async t => {
  writer.clear()
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade', {
    daysAgo: 0,
    to: '00:00:02',
  })
  mock.addBotClass(TestTradeBot, [
    'KRW-BTC',
    'KRW-ETH',
  ])
  await mock.open()
  console.log(`memory.length = ${writer.memory.length}`)
  const m = writer.memory
  t.true(m.length >= 4)
  t.is(m[0], 'started')
  t.is(m[1], 'started')
  t.is(m[m.length - 1], 'finished')
  t.is(m[m.length - 2], 'finished')
  m.splice(0, 2)
  m.splice(m.length - 2, 2)
  let preSeq
  let preName
  while(m.length > 0) {
    const name: string = m.shift()
    const seq: number = m.shift()
    const time: string = m.shift()
    const keys: string[] = m.shift()
    if(preName) {
      t.true(seq >= preSeq)
      if(seq === preSeq) {
        t.is(preName, 'TestTradeBot:KRW-BTC')
        t.is(name, 'TestTradeBot:KRW-ETH')
      }
      preName = name
      preSeq = seq
    } else {
      preName = name
      preSeq = seq
    }
    t.true(['00:00:00', '00:00:01'].some(t => time === t))
    t.deepEqual(keys, [
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
  }
})

// test.serial('OrderMarketMock', async t => {
//   const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'order_market', {
//     daysAgo: 0,
//     to: '00:10:10',
//   })
//   mock.addBot(new TestOrderBot('KRW-BTC', t))
//   await mock.open()
// })

test.serial('TestTradeCandleBot', async t => {
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade_candle', {
    daysAgo: 0,
    to: '00:03:00',
  })
  const bot = new TestTradeCandleBot('KRW-BTC')
  bot.setTestObject(t)
  mock.addBot(bot)
  await mock.open()
})

test.serial('UPbitCandleMock', async t => {
  t.plan(16)
  writer.clear()
  const from = '2021-09-13T00:00:00+00:00'
  const to = '2021-09-13T01:40:00+00:00'
  const mock = new UPbitCandleMock(join(__dirname, 'test-mock.db'), 'candle', {
    from,
    to,
  })
  const bot = new TestCandleBot('KRW-BTC')
  mock.addBot(bot)
  await mock.open()
  const m = writer.memory
  t.is(m.shift(), 'started')
  t.is(m.pop(), 'finished')
  t.is(m.length, 10)
  const api = new UPbitSequence(getConfig().upbit_keys)
  const cc = (await api.allCandlesMinutes(10, {
    market: bot.code,
    from,
    to,
  }))
  t.is(cc.length, 10)
  m.reverse().forEach((o, i) => {
    t.deepEqual(o, {
      open: cc[i].opening_price,
      high: cc[i].high_price,
      low: cc[i].low_price,
      close: cc[i].trade_price,
      volume: cc[i].candle_acc_trade_volume,
      timestamp: new Date(cc[i].candle_date_time_utc + '+00:00').getTime(),
    })
  })
  t.is(m[m.length - 1].timestamp, new Date(from).getTime())
  t.is(m[0].timestamp, new Date(to).getTime() - (1000 * 60 * 10))
})