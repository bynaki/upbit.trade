import test from 'ava'
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
  format,
} from 'fecha'
import {
  logger,
  MemoryWriter,
} from 'fourdollar'
import {
  floor,
} from 'lodash'



const writer = new MemoryWriter()



class TestErrorBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  @subscribe.ticker
  async onTicker(tick: I.TickerType): Promise<void> {}
  @subscribe.orderbook
  async onOrderbook(ord: I.OrderbookType): Promise<void> {}
}



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



class TestTradeCandleBot extends BaseBot {
  done = false

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.candle(1, 10)
  async onCandle1m(ohlcs: I.OHLCType[]) {
    if(ohlcs.length === 3 && this.done === false) {
      const rev = ohlcs.reverse()
      this.log(rev[0])
      this.log(rev[1])
      this.log(rev[2])
      this.done = true
    }
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



class TestCandleBot extends BaseBot {
  ohlcs: I.OHLCType[] = []

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

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

test.serial('trade candle', async t => {
  writer.clear()
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'trade_candle', {
    daysAgo: 0,
    to: '00:03:00',
  })
  const bot = new TestTradeCandleBot('KRW-BTC')
  mock.addBot(bot)
  await mock.open()
  const m = writer.memory
  t.is(m[0], 'started')
  t.is(m[4], 'finished')
  const first: I.OHLCType = m[1]
  const second: I.OHLCType = m[2]
  const api = new UPbitSequence(getConfig().upbit_keys)
  const cc = (await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: format(new Date(first.timestamp), 'isoDateTime'),
    to: format(new Date(m[3].timestamp), 'isoDateTime'),
  })).reverse()
  first.volume = floor(first.volume, 4)
  second.volume = floor(second.volume, 4)
  t.deepEqual(first, {
    open: cc[0].opening_price,
    high: cc[0].high_price,
    low: cc[0].low_price,
    close: cc[0].trade_price,
    volume: floor(cc[0].candle_acc_trade_volume, 4),
    timestamp: new Date(cc[0].candle_date_time_utc + '+00:00').getTime(),
  })
  t.deepEqual(second, {
    open: cc[1].opening_price,
    high: cc[1].high_price,
    low: cc[1].low_price,
    close: cc[1].trade_price,
    volume: floor(cc[1].candle_acc_trade_volume, 4),
    timestamp: new Date(cc[1].candle_date_time_utc + '+00:00').getTime(),
  })
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
