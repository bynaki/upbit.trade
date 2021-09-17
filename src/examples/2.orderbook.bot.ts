/**
 * 호가(Orderbook) 데이터를 10번 출력한다.
 */

import {
  BaseSocketBot,
  UPbitSocket,
  types as I,
} from '../index'



class TestOrderbookBot extends BaseSocketBot {
  private count = 0
  private socket: UPbitSocket

  constructor(code: string) {
    super(code)
  }

  start(socket: UPbitSocket): Promise<void> {
    this.log('stated...')
    this.socket = socket
    return
  }

  finish(): Promise<void> {
    this.log('finished...')
    return
  }

  async onOrderbook(ord: I.OrderbookType) {
    console.log('---------------------------------------')
    console.log(`count: ${++this.count}`)
    console.log(ord)
    if(this.count === 10) {
      await this.socket.close()
    }
  }

  onTicker = null
  onTrade = null
}



const socket = new UPbitSocket()
socket.addBotClass(TestOrderbookBot, ['KRW-BTC', 'KRW-ETH'])
socket.open()