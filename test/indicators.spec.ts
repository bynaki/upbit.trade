import test, {
  ExecutionContext,
} from 'ava'
import {
  SMA,
  EMA,
  RSI,
  RATIO,
  SMA_OHLC,
  EMA_OHLC,
  RSI_OHLC,
  RATIO_OHLC,
  BaseBot,
  types as I,
  UPbitTradeMock,
  subscribe,
} from '../src'
import {
  join,
} from 'path'


test.serial('SMA', t => {
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

test.serial('EMA', t => {
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
    const sma = Math.round(smaIndi(values[i])! * 100) / 100
    const ema = Math.round(emaIndi(values[i])! * 100) / 100
    if(i < 9) {
      t.is(sma, 0)
      t.is(ema, 0)
      continue
    }
    t.is(sma, day10Sma[i - 9])
    t.is(ema, day10Ema[i - 9])
  }
  t.is(Math.round(smaIndi()! * 100) / 100, 23.13)
  t.is(Math.round(emaIndi()! * 100) / 100, 22.92)
})

test.serial('RSI', t => {
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

test.serial('RATIO', t => {
  const ratioIndi = RATIO(14, SMA, 14)
  const values = [
    38, 45, 69, 47, 10, 89, 78, 26, 26, 90,
    74, 53, 42, 30, 21, 15, 56, 47, 73, 12,
  ]
  const rr = [
    (38 - 45) / 38 * 100,
    (45 - 69) / 45 * 100,
    (69 - 47) / 69 * 100,
    (47 - 10) / 47 * 100,
    (10 - 89) / 10 * 100,
    (89 - 78) / 89 * 100,
    (78 - 26) / 78 * 100,
    (26 - 26) / 26 * 100,
    (26 - 90) / 26 * 100,
    (90 - 74) / 90 * 100,
    (74 - 53) / 74 * 100,
    (53 - 42) / 53 * 100,
    (42 - 30) / 42 * 100,
    (30 - 21) / 30 * 100,
    (21 - 15) / 21 * 100,
    (15 - 56) / 15 * 100,
    (56 - 47) / 56 * 100,
    (47 - 73) / 47 * 100,
    (73 - 12) / 73 * 100,
  ]
  let ratio = 0
  for(let i = 0; i < values.length; i++) {
    if(i < 14) {
      t.is(ratioIndi(values[i]), null)
      continue
    }
    let sum = 0
    for(let j = 1; j <= 14; j++) {
      sum += Math.abs(rr[i - j])
    }
    const mean = sum / 14
    ratio = ratioIndi(values[i])!
    t.is(ratio, mean)
  }
  t.is(ratioIndi(), ratio)
})




class TestSMA extends BaseBot {
  smaIndi: (ohlc: I.OHLCType) => number | null
  preTime: number = null! 

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  @subscribe.start
  async start(socket) {
    this.smaIndi = SMA_OHLC(10)
  }

  @subscribe.candle(1, 10)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const sma_ = this.smaIndi(recent)
    const smaF = SMA(10)
    let sma: number | null = null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      sma = smaF(val)
    }
    this.t.is(sma_, sma)
    if(this.preTime !== recent.timestamp) {
      console.log(`sma_ohlc: ${sma_}, sma: ${sma}`)
      this.preTime = recent.timestamp
    }
  }
}

test.serial('SMA: ohlc', async t => {
  const smaBot = new TestSMA('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(smaBot)
  await socket.open()
})


class TestEMA extends BaseBot {
  emaIndi: (ohlc: I.OHLCType) => number | null
  preTime: number

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  @subscribe.start
  async start(socket) {
    this.emaIndi = EMA_OHLC(10)
  }

  @subscribe.candle(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const ema_ = this.emaIndi(recent)
    const emaF = EMA(10)
    let ema: number | null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      ema = emaF(val)
    }
    this.t.is(ema_, ema!)
    if(this.preTime !== recent.timestamp) {
      console.log(`ema_ohlc: ${ema_}, ema: ${ema!}`)
      this.preTime = recent.timestamp
    }
  }
}

test.serial('EMA: ohlc', async t => {
  const emaBot = new TestEMA('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(emaBot)
  await socket.open()
})


class TestRSI extends BaseBot {
  rsiIndi: (ohlc: I.OHLCType) => number | null
  preTime: number

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  @subscribe.start
  async start(socket) {
    this.rsiIndi = RSI_OHLC(10)
  }

  @subscribe.candle(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const rsi_ = this.rsiIndi(recent)
    const rsif = RSI(10)
    let rsi: number | null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      rsi = rsif(val)
    }
    this.t.is(rsi_, rsi!)
    if(this.preTime !== recent.timestamp) {
      console.log(`rsi_ohlc: ${rsi_}, rsi: ${rsi!}`)
      this.preTime = recent.timestamp
    }
  }
}

test.serial('RSI: ohlc', async t => {
  const rsiBot = new TestRSI('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(rsiBot)
  await socket.open()
})


class TestRATIO extends BaseBot {
  ratioIndi: (ohlc: I.OHLCType) => number | null
  preTime: number

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  @subscribe.start
  async start(socket) {
    this.ratioIndi = RATIO_OHLC(10)
  }

  @subscribe.candle(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    const recent = ohlcs[0]
    const ratio_ = this.ratioIndi(recent)
    const ratiof = RATIO(10)
    let ratio: number | null
    for(const val of ohlcs.reverse().map(o => o.close)) {
      ratio = ratiof(val)
    }
    this.t.is(ratio_, ratio!)
    if(this.preTime !== recent.timestamp) {
      console.log(`ratio_ohlc: ${ratio_}, ratio: ${ratio!}`)
      this.preTime = recent.timestamp
    }
  }
}

test.serial('RATIO: ohlc', async t => {
  const ratioBot = new TestRATIO('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test-indicator.db'), 'Indicators', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(ratioBot)
  await socket.open()
})