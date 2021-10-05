/**
 * 봉(Candle) 데이터를 참조할 수 있다.
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  addCandleListener,
} from '../index'



class TestCandleBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  // 1분봉 10개까지 저장
  @addCandleListener(1, 10)
  aMinute(ohlcs: I.OHLCType[]) {
    console.log(ohlcs)
  }

  onTrade = null
  onOrderbook = null
  onTicker = null
  start = null
  finish = null
}


const socket = new UPbitSocket()
socket.addBotClass(TestCandleBot, ['KRW-BTC'])
socket.open()