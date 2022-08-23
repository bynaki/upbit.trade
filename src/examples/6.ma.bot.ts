/**
 * 이동 평균
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'


function ma(ohlcs: I.OHLCType[]) {
  const ma = (ohlcs.map(o => o.close)
  .reduce((sum, c) => {
    sum += c
    return sum
  }, 0)) / ohlcs.length
  return Math.floor(ma)
}


class TestMABot extends BaseBot {
  time = -1

  constructor(code: string) {
    super(code)
  }

  @subscribe.candle(1, 11)
  aMinute(ohlcs: I.OHLCType[]) {
    if(this.time === -1) {
      this.time = ohlcs[0].timestamp
      return
    }
    if(ohlcs[0].timestamp !== this.time) {
      this.time = ohlcs[0].timestamp
      console.log('')
      console.log('time:', new Date(this.time))
      console.log('ma:', ma(ohlcs.splice(1)))
    }
  }
}


const socket = new UPbitSocket()
socket.addBotClass(TestMABot, ['KRW-BTC'])
socket.open()