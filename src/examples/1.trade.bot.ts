/**
 * 5초 단위로 체결(Trade) 데이터를 출력한다.
**/

import {
  BaseBot,
  subscribe,
  UPbitSocket,
  types as I,
} from '../index'



class TradeBot extends BaseBot {
  private preTime = -1
  private preCount = 0
  private count = 0

  constructor(code: string) {
    super(code)
  }
  
  @subscribe.trade
  async onTrade(tr: I.TradeType) {
    this.preCount++
    const floorTime = Math.floor(tr.trade_timestamp / 5000)
    if(this.preTime < floorTime) {
      console.log('--------------------------------------------')
      console.log(`count: ${this.preCount}`)
      console.log(tr)
      this.preCount = 0
      this.preTime = floorTime
      console.log('latest:')
      console.log(this.latest(I.ReqType.Trade))
      if(++this.count === 5) {
        socket.close(true)
      }
    }
  }

  @subscribe.finish
  async finish() {
    console.log('finished')
  }

  // async onTrade(tr: I.TradeType) {
  //     console.log('--------------------------------------------')
  //     console.log(tr)
  // }
}


const socket = new UPbitSocket()
socket.addBotClass(TradeBot, ['KRW-BTC'])
socket.open()
