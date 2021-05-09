import {
  BaseSocketBot,
  UPbitSocket,
  types as I,
} from '../index'


/**
 * 5초 단위로 체결(Trade) 데이터를 출력한다.
**/
class TestBot extends BaseSocketBot {
  private _preTime = -1
  private _count = 0

  constructor(code: string) {
    super(code)
  }
  
  async onTrade(data: I.TradeType) {
    this._count++
    const floorTime = Math.floor(data.trade_timestamp / 5000)
    if(this._preTime < floorTime) {
      console.log('--------------------------------------------')
      console.log(`count: ${this._count}`)
      console.log(data)
      this._count = 0
      this._preTime = floorTime
    }
  }

  init = null
  onClose = null
  onOrderbook = null
  onTicker = null
}


const ws = new UPbitSocket(['KRW-BTC'])
ws.addBotClass(TestBot)
ws.start()
