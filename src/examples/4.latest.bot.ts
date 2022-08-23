/**
 * 가장 최근 데이터를 참조할 수 있다.
 */

import {
  BaseBot,
  UPbitSocket,
  types as I,
  subscribe,
} from '../index'



class TestLatestDatasBot extends BaseBot {
  socket: UPbitSocket

  constructor(code: string) {
    super(code)
  }

  @subscribe.start
  start(socket: UPbitSocket): Promise<void> {
    this.socket = socket
    return
  }

  @subscribe.trade
  async onTrade(tr: I.TradeType) {
    console.log('Latest Trade:')
    console.log(this.latest(I.ReqType.Trade))
    console.log('')
    console.log('Latest Orderbook:')
    console.log(this.latest(I.ReqType.Orderbook))
    console.log('')
    console.log('Latest Ticker:')
    console.log(this.latest(I.ReqType.Ticker))
    this.socket.close(true)
  }

  @subscribe.orderbook
  async onOrderbook(ob: I.OrderbookType) {}
  @subscribe.ticker
  async onTicker(tk: I.TickerType) {}
}


const socket = new UPbitSocket()
socket.addBotClass(TestLatestDatasBot, ['KRW-BTC'])
socket.open()