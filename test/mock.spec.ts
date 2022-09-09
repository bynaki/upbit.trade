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



class TradeCandleBot extends BaseBot {
  mm1: {
    name: string
    ohlc: I.OHLCType
    length: number
  }
  mm1l5: {
    name: string
    ohlc: I.OHLCType
    length: number
  }
  mm3: {
    name: string
    ohlc: I.OHLCType
    length: number
  }

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.candle(1)
  async m1(ohlcs: I.OHLCType[]) {
    if(!this.mm1) {
      this.mm1 = {
        name: 'm1',
        ohlc: ohlcs[0],
        length: ohlcs.length,
      }
      return
    }
    if(this.mm1.ohlc.timestamp !== ohlcs[0].timestamp) {
      this.log(this.mm1)
    }
    this.mm1 = {
      name: 'm1',
      ohlc: ohlcs[0],
      length: ohlcs.length,
    }
  }

  @subscribe.candle(1, 5)
  async m1l5(ohlcs: I.OHLCType[]) {
    if(!this.mm1l5) {
      this.mm1l5 = {
        name: 'm1l5',
        ohlc: ohlcs[0],
        length: ohlcs.length,
      }
      return
    }
    if(this.mm1l5.ohlc.timestamp !== ohlcs[0].timestamp) {
      this.log(this.mm1l5)
    }
    this.mm1l5 = {
      name: 'm1l5',
      ohlc: ohlcs[0],
      length: ohlcs.length,
    }
  }

  @subscribe.candle(3, 4)
  async m3(ohlcs: I.OHLCType[]) {
    if(!this.mm3) {
      this.mm3 = {
        name: 'm3',
        ohlc: ohlcs[0],
        length: ohlcs.length,
      }
      return
    }
    if(this.mm3.ohlc.timestamp !== ohlcs[0].timestamp) {
      this.log(this.mm3)
    }
    this.mm3 = {
      name: 'm3',
      ohlc: ohlcs[0],
      length: ohlcs.length,
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



class CandleBot extends BaseBot {
  mm1: {
    name: string
    ohlc: I.OHLCType
    length: number
  }
  mm1l5: {
    name: string
    ohlc: I.OHLCType
    length: number
  }
  mm3: {
    name: string
    ohlc: I.OHLCType
    length: number
  }

  constructor(code: string) {
    super(code)
  }

  @logger(writer)
  log(msg: any) {
    return msg
  }

  @subscribe.candle(1)
  async m1(ohlcs: I.OHLCType[]) {
    this.log({
      name: 'm1',
      ohlc: ohlcs[0],
      length: ohlcs.length,
    })
  }

  @subscribe.candle(1, 5)
  async m1l5(ohlcs: I.OHLCType[]) {
    this.log({
      name: 'm1l5',
      ohlc: ohlcs[0],
      length: ohlcs.length,
    })
  }

  @subscribe.candle(3, 4)
  async m3(ohlcs: I.OHLCType[]) {
    this.log({
      name: 'm3',
      ohlc: ohlcs[0],
      length: ohlcs.length,
    })
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
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'mock_trade', {
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
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'mock_trade', {
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

test.serial('UPbitTradeMock: candle', async t => {
  writer.clear()
  const mock = new UPbitTradeMock(join(__dirname, 'test-mock.db'), 'mock_trade_candle', {
    daysAgo: 0,
    to: '00:16:00',
  })
  const bot = new TradeCandleBot('KRW-BTC')
  mock.addBot(bot)
  await mock.open()
  const m = writer.memory
  t.is(m.length, 37)
  t.is(m[0], 'started')
  t.is(m[m.length - 1], 'finished')
  m.splice(0, 1)
  m.splice(m.length - 1, 1)
  const m1: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm1').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  const m1l5: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm1l5').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  const m3: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm3').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  console.log('m1 ------------------------------------------')
  console.log(m1)
  console.log('m1l5 ----------------------------------------')
  console.log(m1l5)
  console.log('m3 ------------------------------------------')
  console.log(m3)
  t.is(m1.length, 15)
  m1.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 10))
  })
  t.is(m1l5.length, 15)
  m1l5.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 5))
  })
  t.is(m3.length, 5)
  m3.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 4))
  })
  const api = new UPbitSequence(getConfig().upbit_keys)
  const c1 = (await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: format(new Date(m1[0].ohlc.timestamp), 'isoDateTime'),
    to: format(new Date(m1[m1.length - 1].ohlc.timestamp + 1000 * 60), 'isoDateTime'),
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m1.length, c1.length)
  for(let i = 0; i < m1.length; i++) {
    t.deepEqual(m1[i].ohlc, c1[i])
  }
  const c1l5 = (await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from: format(new Date(m1l5[0].ohlc.timestamp), 'isoDateTime'),
    to: format(new Date(m1l5[m1l5.length - 1].ohlc.timestamp + 1000 * 60), 'isoDateTime'),
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m1l5.length, c1l5.length)
  for(let i = 0; i < m1l5.length; i++) {
    t.deepEqual(m1l5[i].ohlc, c1l5[i])
  }
  const c3 = (await api.allCandlesMinutes(3, {
    market: 'KRW-BTC',
    from: format(new Date(m3[0].ohlc.timestamp), 'isoDateTime'),
    to: format(new Date(m3[m3.length - 1].ohlc.timestamp + 1000 * 60), 'isoDateTime'),
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m3.length, c3.length)
  for(let i = 0; i < m3.length; i++) {
    t.deepEqual(m3[i].ohlc, c3[i])
  }
})

test.serial('UPbitCandleMock', async t => {
  writer.clear()
  const from = '2022-09-01T00:00:00+00:00'
  const to = '2022-09-01T00:15:00+00:00'
  const mock = new UPbitCandleMock(join(__dirname, 'test-mock.db'), 'mock_candle', {
    from,
    to,
  })
  const bot = new CandleBot('KRW-BTC')
  mock.addBot(bot)
  await mock.open()
  const m = writer.memory
  t.is(m.length, 37)
  t.is(m[0], 'started')
  t.is(m[m.length - 1], 'finished')
  m.splice(0, 1)
  m.splice(m.length - 1, 1)
  const m1: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm1').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  const m1l5: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm1l5').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  const m3: {
    name: string
    ohlc: I.OHLCType
    length: number
  }[] = m.filter(o => o.name === 'm3').map(o => {
    o.ohlc.volume = floor(o.ohlc.volume, 4)
    o.time = format(new Date(o.ohlc.timestamp), 'isoDateTime')
    return o
  })
  console.log('m1 ------------------------------------------')
  console.log(m1)
  console.log('m1l5 ----------------------------------------')
  console.log(m1l5)
  console.log('m3 ------------------------------------------')
  console.log(m3)
  t.is(m1.length, 15)
  m1.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 10))
  })
  t.is(m1l5.length, 15)
  m1l5.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 5))
  })
  t.is(m3.length, 5)
  m3.forEach((m, i) => {
    t.is(m.length, Math.min(i + 1, 4))
  })
  const api = new UPbitSequence(getConfig().upbit_keys)
  const c1 = (await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from,
    to,
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m1.length, c1.length)
  for(let i = 0; i < m1.length; i++) {
    t.deepEqual(m1[i].ohlc, c1[i])
  }
  const c1l5 = (await api.allCandlesMinutes(1, {
    market: 'KRW-BTC',
    from,
    to,
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m1l5.length, c1l5.length)
  for(let i = 0; i < m1l5.length; i++) {
    t.deepEqual(m1l5[i].ohlc, c1l5[i])
  }
  const c3 = (await api.allCandlesMinutes(3, {
    market: 'KRW-BTC',
    from,
    to,
  })).reverse().map((c): I.OHLCType => {
    return {
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: floor(c.candle_acc_trade_volume, 4),
      timestamp: new Date(c.candle_date_time_utc + '+00:00').getTime(),
    }
  })
  t.is(m3.length, c3.length)
  for(let i = 0; i < m3.length; i++) {
    t.deepEqual(m3[i].ohlc, c3[i])
  }
})
