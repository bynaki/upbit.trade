/**
 * 5초 단위로 체결(Trade) 데이터를 출력한다.
**/

import {
  BaseBot,
  UPbitSocket,
  types as I,
} from '../index'



class TradeBot extends BaseBot {
  private preTime = -1
  private count = 0

  constructor(code: string) {
    super(code)
  }
  
  async onTrade(tr: I.TradeType) {
    this.count++
    const floorTime = Math.floor(tr.trade_timestamp / 5000)
    if(this.preTime < floorTime) {
      console.log('--------------------------------------------')
      console.log(`count: ${this.count}`)
      console.log(tr)
      this.count = 0
      this.preTime = floorTime
      console.log('latest:')
      console.log(this.latest(I.ReqType.Trade))
    }
  }

  start = null
  finish = null
  onOrderbook = null
  onTicker = null
}


const socket = new UPbitSocket()
socket.addBotClass(TradeBot, ['KRW-BTC'])
socket.open()
