/**
 * 가장 최근 데이터를 참조할 수 있다.
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



class TestLatestDatasBot extends BaseBot {
  socket: UPbitSocket

  constructor(code: string) {
    super(code)
  }

  @logger()
  log(msg: any): any {
    return msg
  }

  @subscribe.start
  start(socket: UPbitSocket) {
    this.socket = socket
    this.log('started...')
  }

  @subscribe.trade
  async onTrade(tr: I.TradeType) {
    this.log('Latest Trade:')
    this.log(this.latest(I.ReqType.Trade))
    this.log('')
    this.log('Latest Orderbook:')
    this.log(this.latest(I.ReqType.Orderbook))
    this.log('')
    this.log('Latest Ticker:')
    this.log(this.latest(I.ReqType.Ticker))
    await this.socket.close(true)
  }

  @subscribe.finish
  finsh() {
    this.log('finished...')
  }

  @subscribe.orderbook
  async onOrderbook(ob: I.OrderbookType) {}
  @subscribe.ticker
  async onTicker(tk: I.TickerType) {}
}


const socket = new UPbitSocket()
socket.addBotClass(TestLatestDatasBot, ['KRW-BTC'])
socket.open()