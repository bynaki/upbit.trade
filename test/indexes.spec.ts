import test, {
  ExecutionContext,
} from 'ava'
import {
  SMA,
  EWMA,
  RSI,
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



class TestSMA extends BaseBot {
  ma: number
  sma: number
  smaf: (ohlc: I.OHLCType) => number

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start(socket: BaseUPbitSocket) {
    this.smaf = SMA(10)
  }

  @addCandleListener(1, 10)
  on1m(ohlcs: I.OHLCType[]) {
    this.ma = ohlcs.reduce((p, o) => p + o.close, 0) / ohlcs.length
    this.sma = this.smaf(ohlcs[0])
    this.t.is(this.ma, this.sma)
  }

  finish = null
  onTrade = null
  onTicker = null
  onOrderbook = null
}


function testEWMA(ohlcs: I.OHLCType[], days: number) {
  return ohlcs.reduceRight((pre, o) => ((1 - (1 / days)) * pre) + ((1 / days) * o.close), ohlcs[ohlcs.length - 1].close)
}


class TestEWMABot extends BaseBot {
  ewmaf: (ohlc: I.OHLCType) => number
  ma
  ewma

  constructor(code: string, private readonly t: ExecutionContext) {
    super(code)
  }

  async start() {
    this.ewmaf = EWMA(10)
  }

  @addCandleListener(1, 20)
  on1m(ohlcs: I.OHLCType[]) {
    this.ma = testEWMA(ohlcs, 10)
    this.ewma = this.ewmaf(ohlcs[0])
    this.t.is(this.ma, this.ewma)
  }

  finish = null
  onOrderbook = null
  onTicker = null
  onTrade = null
}


test.serial('SMA', async t => {
  const bot = new TestSMA('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test_mock.db'), 'indexes_ma', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(bot)
  await socket.open()
  console.log(`ma: ${bot.ma}, sma: ${bot.sma}`)
  t.is(bot.ma, bot.sma)
})

test.serial('SMA: candle', async t => {
  const bot = new TestSMA('KRW-BTC', t)
  const socket = new UPbitCandleMock(join(__dirname, 'test_mock.db'), 'indexes_ma_candle', {
    from: isoDateTime(agoMinutes(20))
  })
  socket.addBot(bot)
  await socket.open()
  console.log(`ma: ${bot.ma}, sma: ${bot.sma}`)
  t.is(bot.ma, bot.sma)
})

test.serial('EWMA', async t => {
  const bot = new TestEWMABot('KRW-BTC', t)
  const socket = new UPbitTradeMock(join(__dirname, 'test_mock.db'), 'indexes_ma', {
    daysAgo: 0,
    to: '00:20:00',
  })
  socket.addBot(bot)
  await socket.open()
  console.log(`ma: ${bot.ma}, ewma: ${bot.ewma}`)
  t.is(bot.ma, bot.ewma)
})

test.serial.only('EWMA: candle', async t => {
  const bot = new TestEWMABot('KRW-BTC', t)
  const socket = new UPbitCandleMock(join(__dirname, 'test_mock.db'), 'indexes_ma_candle', {
    from: isoDateTime(agoMinutes(20))
  })
  socket.addBot(bot)
  await socket.open()
  console.log(`ma: ${bot.ma}, ewma: ${bot.ewma}`)
  t.is(bot.ma, bot.ewma)
})
