/**
 * 현재가(Ticker) 데이터 출력
 */

import {
  BaseSocketBot,
  UPbitSocket,
  types as I,
} from '../index'



class TestTickerBot extends BaseSocketBot {
  private count = 0

  constructor(code: string) {
    super(code)
  }

  start(socket: UPbitSocket): Promise<void> {
    this.log('stated...')
    return
  }

  finish(): Promise<void> {
    this.log('finished...')
    return
  }

  async onTicker(tk: I.TickerType) {
    console.log('---------------------------------------')
    console.log(`count: ${++this.count}`)
    console.log(tk)
  }

  onTrade = null
  onOrderbook = null
}



const socket = new UPbitSocket()
socket.addBotClass(TestTickerBot, ['KRW-BTC', 'KRW-ETH'])
socket.open()