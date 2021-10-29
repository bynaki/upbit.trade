import test, {
  ExecutionContext,
} from 'ava'
import {
  SMA,
  EMA,
  RSI,
  SMA_OHLC,
  EMA_OHLC,
  RSI_OHLC,
  BaseBot,
  addCandleListener,
  types as I,
  BaseUPbitSocket,
  UPbitCandleMock,
  UPbitTradeMock,
  agoMinutes,
  isoDateTime,
} from '../src'
import {
  join,
} from 'path'
import { times } from 'lodash'


test('SMA', t => {
  const smaIndi = SMA(5)
  t.plan(8)
  const values = [11, 12, 13, 14, 15, 16, 17]
  for(let i = 0; i < values.length; i++) {
    const sma = smaIndi(values[i])
    if(i < 4) {
      t.is(sma, null)
    }
    switch(i) {
      case 4:
        t.is(sma, 13)
        break
      case 5:
        t.is(sma, 14)
        break
      case 6:
        t.is(sma, 15)
        break
    }
  }
  t.is(smaIndi(), 15)
})

test('EMA', t => {
  const smaIndi = SMA(10)
  const emaIndi = EMA(10)
  const values = [
    22.27, 22.19, 22.08, 22.17, 22.18,
    22.13, 22.23, 22.43, 22.24, 22.29,
    22.15, 22.39, 22.38, 22.61, 23.36,
    24.05, 23.75, 23.83, 23.95, 23.63,
    23.82, 23.87, 23.65, 23.19, 23.10,
    23.33, 22.68, 23.10, 22.40, 22.17,
  ]
  const day10Sma = [
    22.22, 22.21, 22.23, 22.26, 22.30,
    22.42, 22.61, 22.77, 22.91, 23.08,
    23.21, 23.38, 23.53, 23.65, 23.71,
    23.68, 23.61, 23.50, 23.43, 23.28, 23.13,
  ]
  const day10Ema = [
    22.22, 22.21, 22.24, 22.27, 22.33,
    22.52, 22.80, 22.97, 23.13, 23.28,
    23.34, 23.43, 23.51, 23.53, 23.47,
    23.40, 23.39, 23.26, 23.23, 23.08, 22.92,
  ]
  for(let i = 0; i < values.length; i++) {
    const sma = Math.round(smaIndi(values[i]) * 100) / 100
    const ema = Math.round(emaIndi(values[i]) * 100) / 100
    if(i < 9) {
      t.is(sma, 0)
      t.is(ema, 0)
      continue
    }
    t.is(sma, day10Sma[i - 9])
    t.is(ema, day10Ema[i - 9])
  }
  t.is(Math.round(smaIndi() * 100) / 100, 23.13)
  t.is(Math.round(emaIndi() * 100) / 100, 22.92)
})

test('RSI', t => {
  const rsiIndi = RSI(14)
  const values = [
    44.34, 44.09, 44.15, 43.61, 44.33,
    44.83, 45.10, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28,
    46.00, 46.03, 46.41, 46.22, 45.64,
    46.21, 46.25, 45.71, 46.45, 45.78,
    45.35, 44.03, 44.18, 44.22, 44.57,
    43.42, 42.66, 43.13,
  ]
  const returneds = [
    70.46413502109705,
    66.24961855355505,
    66.48094183471267,
    69.34685316290866,
    66.29471265892624,
    57.91502067008557,
    62.88071830996241,
    63.20878871828778,
    56.01158478954757,
    62.33992931089789,
    54.67097137765516,
    50.386815195114224,
    40.019423791313564,
    41.49263540422282,
    41.902429678458105,
    45.499497238680405,
    37.322778313379956,
    33.09048257272339,
    37.788771982057824,
  ]
  for(let i = 0; i < values.length; i++) {
    if(i < 14) {
      t.is(rsiIndi(values[i]), null)
      continue
    }
    t.is(rsiIndi(values[i]), returneds[i - 14])
  }
  t.is(rsiIndi(), returneds[returneds.length - 1])
})


class TestSMA extends BaseBot {
  smaIndi: (ohlc: I.OHLCType) => number
  preTime: number = null

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start(socket) {
    this.smaIndi = SMA_OHLC(10)
  }

  @addCandleListener(1, 10)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const sma_ = this.smaIndi(recent)
    const smaF = SMA(10)
    let sma = null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      sma = smaF(val)
    }
    this.t.is(sma_, sma)
    if(this.preTime !== recent.timestamp) {
      console.log(`sma_ohlc: ${sma_}, sma: ${sma}`)
      this.preTime = recent.timestamp
    }
  }

  onOrderbook = null
  onTicker = null
  onTrade = null
  finish = null
}

test('SMA: ohlc', async t => {
  const smaBot = new TestSMA('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(smaBot)
  await socket.open()
})


class TestEMA extends BaseBot {
  emaIndi: (ohlc: I.OHLCType) => number
  preTime: number = null

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start(socket) {
    this.emaIndi = EMA_OHLC(10)
  }

  @addCandleListener(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const ema_ = this.emaIndi(recent)
    const emaF = EMA(10)
    let ema = null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      ema = emaF(val)
    }
    this.t.is(ema_, ema)
    if(this.preTime !== recent.timestamp) {
      console.log(`ema_ohlc: ${ema_}, ema: ${ema}`)
      this.preTime = recent.timestamp
    }
  }

  onOrderbook = null
  onTicker = null
  onTrade = null
  finish = null
}

test('EMA: ohlc', async t => {
  const emaBot = new TestEMA('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(emaBot)
  await socket.open()
})


class TestRSI extends BaseBot {
  rsiIndi: (ohlc: I.OHLCType) => number
  preTime: number = null

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start(socket) {
    this.rsiIndi = RSI_OHLC(10)
  }

  @addCandleListener(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const rsi_ = this.rsiIndi(recent)
    const rsif = RSI(10)
    let rsi = null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      rsi = rsif(val)
    }
    this.t.is(rsi_, rsi)
    if(this.preTime !== recent.timestamp) {
      console.log(`rsi_ohlc: ${rsi_}, rsi: ${rsi}`)
      this.preTime = recent.timestamp
    }
  }

  onOrderbook = null
  onTicker = null
  onTrade = null
  finish = null
}

test('RSI: ohlc', async t => {
  const rsiBot = new TestRSI('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(rsiBot)
  await socket.open()
})
