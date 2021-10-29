/**
 * RSI (Relative Strength Index)
 */

import {
  BaseBot,
  UPbitCandleMock,
  addCandleListener,
  types as I,
  RSI_OHLC,
  agoHours,
  isoDateTime,
} from '../'
import {
  join,
} from 'path'



class RSIBot extends BaseBot {
  rsiIndi: (ohlc: I.OHLCType) => number
  pre: number

  constructor(code: string) {
    super(code)
    this.rsiIndi = RSI_OHLC(14)
  }

  @addCandleListener(15, 14)
  m15(ohlcs: I.OHLCType[]) {
    const rsi = this.rsiIndi(ohlcs[0])
    if(rsi === null) {
      return
    }
    if(rsi < 30) {
      this.log(`30down: (rsi: ${rsi}), (time: ${new Date(ohlcs[0].timestamp)})`)
    }
    if(rsi > 70) {
      this.log(`70down: (rsi: ${rsi}), (time: ${new Date(ohlcs[0].timestamp)})`)
    }
  }

  onTrade = null
  onOrderbook = null
  onTicker = null
  start = null
  finish = null
}



(async () => {
  // 3일전
  const ago = agoHours(24 * 3, Date.now())
  // iso date type 으로 변환
  const from = isoDateTime(new Date(ago))
  const socket = new UPbitCandleMock(join(__dirname, 'example.db'), 'rsi', {
    from,
  })
  socket.addBot(new RSIBot('KRW-BTC'))
  await socket.open()
})()