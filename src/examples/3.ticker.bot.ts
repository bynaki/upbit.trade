/**
 * 현재가(Ticker) 데이터 출력
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'
import {
  logger,
} from 'fourdollar'



class TestTickerBot extends BaseBot {
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
  start(socket: UPbitSocket): Promise<void> {
    this.socket = socket
    this.log('started...')
    return
  }

  @subscribe.finish
  finish(): Promise<void> {
    this.log('finished...')
    return
  }

  @subscribe.ticker
  async onTicker(tk: I.TickerType) {
    this.log('---------------------------------------')
    this.log(`count: ${++this.count}`)
    this.log(tk)
    if(this.count === 10) {
      await this.socket.close(true)
    }
  }
}



const socket = new UPbitSocket()
socket.addBotClass(TestTickerBot, ['KRW-BTC', 'KRW-ETH'])
socket.open()