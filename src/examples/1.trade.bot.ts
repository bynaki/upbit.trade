/**
 * 5초 단위로 체결(Trade) 데이터를 출력한다.
**/

import { logger } from 'fourdollar'
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
    this.log('started')
    this.socket = socket
  }
  
  @subscribe.trade
  async trade(tr: I.TradeType) {
    this.preCount++
    const floorTime = Math.floor(tr.trade_timestamp / 5000)
    if(this.preTime < floorTime) {
      this.log('--------------------------------------------')
      this.log(`count: ${this.preCount}`)
      this.log(tr)
      this.preCount = 0
      this.preTime = floorTime
      this.log('latest:')
      this.log(this.latest(I.ReqType.Trade))
      if(++this.count === 5) {
        socket.close(true)
      }
    }
  }

  @subscribe.finish
  async finish() {
    this.log('finished')
    this.socket.close(true)
  }
}


const socket = new UPbitSocket()
socket.addBotClass(TradeBot, ['KRW-BTC'])
socket.open()
