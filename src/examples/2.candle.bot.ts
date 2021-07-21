import {
  UPbitSocket,
  BaseSocketBot,
  types as I,
} from '../index'
import { format } from 'fecha'
import { addCandleListener, BaseCandleBot } from '../base.bot'



function printCandle(c: I.OHLCType) {
  console.log(`mts: ${format(new Date(c.timestamp), 'HH:mm:ss')}`)
  console.log(`open: ${c.open}`)
  console.log(`close: ${c.close}`)
  console.log(`high: ${c.high}`)
  console.log(`low: ${c.low}`)
  console.log(`volume: ${c.volume}`)
}


class CandleBot extends BaseCandleBot {
  thisTime: number = -1

  constructor(code: string) {
    super(code)
  }

  @addCandleListener(1, 10)
  on1m(c: I.OHLCType[]) {
    if(c[0].timestamp !== this.thisTime) {
      this.thisTime = c[0].timestamp
      if(c.length > 1) {
        console.log('----------------------')
        console.log(`length: ${c.length}`)
        printCandle(c[1])
      }
    }
  }

  start = null
  finish = null
}



const ws = new UPbitSocket(['KRW-BTC'])
ws.addBotClass(CandleBot)
ws.open()
