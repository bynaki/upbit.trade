/**
 * 봉(Candle) 데이터를 참조할 수 있다.
 */

import { logger } from 'fourdollar'
import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'



class TestCandleBot extends BaseBot {
  private socket: UPbitSocket

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

  // 1분봉 10개까지 저장
  @subscribe.candle(1, 10)
  aMinute(ohlcs: I.OHLCType[]) {
    this.log(ohlcs)
    if(ohlcs.length === 2) {
      this.socket.close(true)
    }
  }

  @subscribe.finish
  finish() {
    this.log('finished...')
  }
}


const socket = new UPbitSocket()
socket.addBotClass(TestCandleBot, ['KRW-BTC'])
socket.open()