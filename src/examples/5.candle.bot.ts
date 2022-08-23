/**
 * 봉(Candle) 데이터를 참조할 수 있다.
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'



class TestCandleBot extends BaseBot {
  constructor(code: string) {
    super(code)
  }

  // 1분봉 10개까지 저장
  @subscribe.candle(1, 10)
  aMinute(ohlcs: I.OHLCType[]) {
    console.log(ohlcs)
  }
}


const socket = new UPbitSocket()
socket.addBotClass(TestCandleBot, ['KRW-BTC'])
socket.open()