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

  constructor(code: string) {
    super(code)
  }

  @logger()
  log(msg: string) {
    return `${new Date().toLocaleString()} > ${msg}`
  }

  @subscribe.start
  start(socket: UPbitSocket): Promise<void> {
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
    console.log('---------------------------------------')
    console.log(`count: ${++this.count}`)
    console.log(tk)
  }
}



const socket = new UPbitSocket()
socket.addBotClass(TestTickerBot, ['KRW-BTC', 'KRW-ETH'])
socket.open()