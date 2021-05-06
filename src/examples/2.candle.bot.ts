import {
  UPbitSocket,
  BaseSocketBot,
  types as I,
} from '../index'
import { format } from 'fecha'



interface CandleType {
  mts: number
  open: number
  close: number
  hight: number
  low: number
  volume: number
}

function printCandle(c: CandleType) {
  console.log(`mts: ${format(new Date(c.mts), 'HH:mm:ss')}`)
  console.log(`open: ${c.open}`)
  console.log(`close: ${c.close}`)
  console.log(`hight: ${c.hight}`)
  console.log(`low: ${c.low}`)
  console.log(`volume: ${c.volume}`)
}


class CandleMaker {
  private _ms: number
  private _count: number
  private _trs: I.TradeType[] = []
  private _standbyTrs: I.TradeType[] = []

  constructor(ms: number, count: number) {
    this._ms = ms * 60000
    this._count = count
  }

  push(tr: I.TradeType): CandleType {
    if(this._standbyTrs.length === 0) {
      this._standbyTrs.unshift(tr)
      return
    }
    if(tr.trade_timestamp === this._standbyTrs[0].trade_timestamp) {
      this._standbyTrs.unshift(tr)
      return
    }
    if(tr.trade_timestamp < this._standbyTrs[0].trade_timestamp) {
      this._trs.unshift(tr)
      if((this._standbyTrs[0].trade_timestamp - tr.trade_timestamp) !== 1000) {
        console.log('error!!!!!')
        console.log(`standbyTrs[0]: ${format(new Date(this._standbyTrs[0].trade_timestamp), 'HH:mm:ss')}`)
        console.log(`[0]: ${format(new Date(this._trs[0].trade_timestamp), 'HH:mm:ss')}`)
      }
      return
    }
    const trs = this._trs
    trs.unshift(...this._standbyTrs)
    this._standbyTrs = [tr]
    while(trs[trs.length - 1].trade_timestamp < trs[trs.length - 1].trade_timestamp - (this._ms * (this._count))) {
      trs.pop()
    }
  }

  get(): CandleType[] {
    if(this._trs.length === 0) {
      return null
    }
    const cs: CandleType[] = []
    for(let i = 0 ; i < this._count ; i++) {
      cs.push({
        mts: 0,
        open: 0,
        close: 0,
        hight: 0,
        low: 0,
        volume: 0,
      })
    }
    this._trs.forEach(tr => {
      for(let i = 0 ; i < this._count ; i++) {
        const mts = this._standbyTrs[0].trade_timestamp - (this._ms * i)
        if(tr.trade_timestamp < mts && tr.trade_timestamp >= mts - (this._ms)) {
          if(cs[i].mts === 0) {
            cs[i] = {
              mts: tr.trade_timestamp,
              open: tr.trade_price,
              close: tr.trade_price,
              hight: tr.trade_price,
              low: tr.trade_price,
              volume: tr.trade_volume,
            }
            return
          }
          const candle = cs[i]
          candle.mts = Math.min(candle.mts, tr.trade_timestamp)
          candle.open = tr.trade_price
          candle.hight = Math.max(candle.hight, tr.trade_price)
          candle.low = Math.min(candle.low, tr.trade_price)
          candle.volume += tr.trade_volume
          return
        }
      }
    })
    return cs
  }
}

function floorTime(timestamp: number, ms: number) {
  return Math.floor(timestamp / (ms * 60000)) * (ms * 60000)
}

class CandleBot extends BaseSocketBot {
  private _minutes = 1
  private _count = 5
  private _cm = new CandleMaker(this._minutes, this._count)
  private _preTime = -1

  constructor(code: string) {
    super(code)
  }
  
  async init() {}

  async onTrade(tr: I.TradeType) {
    this._cm.push(tr)
    if(this._preTime === -1) {
      this._preTime = floorTime(tr.trade_timestamp, this._minutes)
      return
    }
    if(this._preTime !== floorTime(tr.trade_timestamp, this._minutes)) {
      console.log('')
      console.log('----------------------------------------')
      this._cm.get().forEach(c => {
        printCandle(c)
        console.log('')
      })
      this._preTime = floorTime(tr.trade_timestamp, this._minutes)
    }
  }

  onOrderbook = null
  onTicker = null
}


const ws = new UPbitSocket(['KRW-BTC'])
ws.addBotClass(CandleBot)
ws.start()
