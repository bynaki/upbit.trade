/**
 * 이동 평균
 */

import { logger } from 'fourdollar'
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
  time: number
  socket: UPbitSocket

  constructor(code: string) {
    super(code)
  }

  @logger()
  log(msg: any) {
    return msg
  }

  @subscribe.start
  start(socket: UPbitSocket) {
    this.log('started...')
    this.socket = socket
  }

  @subscribe.candle(1, 11)
  async aMinute(ohlcs: I.OHLCType[]) {
    if(!this.time) {
      this.time = ohlcs[0].timestamp
      return
    }
    if(ohlcs[0].timestamp !== this.time) {
      this.time = ohlcs[0].timestamp
      this.log('')
      this.log(`length: ${ohlcs.length}`)
      this.log({
        time: new Date(this.time),
        ma: ma(ohlcs.slice(1, 11)),
      })
      if(ohlcs.length === 11) {
        this.log('closing...')
        await this.socket.close(true)
      }
    }
  }

  @subscribe.finish
  finish() {
    this.log('finished...')
  }
}


const socket = new UPbitSocket()
socket.addBotClass(TestMABot, ['KRW-BTC'])
socket.open()