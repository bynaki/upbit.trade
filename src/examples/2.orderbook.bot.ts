/**
 * 호가(Orderbook) 데이터를 10번 출력한다.
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'
import {
  logger
} from 'fourdollar'



class TestOrderbookBot extends BaseBot {
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
    this.log('started...')
    this.socket = socket
    return
  }

  @subscribe.finish
  finish(): Promise<void> {
    this.log('finished...')
    return
  }

  @subscribe.orderbook
  async onOrderbook(ord: I.OrderbookType) {
    this.log('---------------------------------------')
    this.log(`count: ${++this.count}`)
    this.log(ord)
    if(this.count === 10) {
      await this.socket.close(true)
    }
  }
}



const socket = new UPbitSocket()
socket.addBotClass(TestOrderbookBot, ['KRW-BTC', 'KRW-ETH'])
socket.open()