import {
  readFileSync
} from 'fs'
import * as I from './types'
import {
  UPbit,
  upbit_types as Iu,
} from 'cryptocurrency.api'
import { isNumber, isString } from 'lodash'
import { format } from 'fecha'



export function getConfig(fileName: string = './config.json'): I.Config {
  return JSON.parse((readFileSync(fileName)).toString())
}

// export function floor(val: number, jari: number) {
//   return Math.floor(val * Math.pow(10, jari)) / Math.pow(10, jari)
// }

// export function ceil(val: number, jari: number) {
//   return Math.ceil(val * Math.pow(10, jari)) / Math.pow(10, jari)
// }

export function floorOrderbook(price: number) {
  if(price >= 2000000) {
    return Math.floor(price / 1000) * 1000
  }
  if(price >= 1000000 && price < 2000000) {
    return Math.floor(price / 500) * 500
  }
  if(price >= 500000 && price < 1000000) {
    return Math.floor(price / 100) * 100
  }
  if(price >= 100000 && price < 500000) {
    return Math.floor(price / 50) * 50
  }
  if(price >= 10000 && price < 100000) {
    return Math.floor(price / 10) * 10
  }
  if(price >= 1000 && price < 10000) {
    return Math.floor(price / 5) * 5
  }
  if(price >= 100 && price < 1000) {
    return Math.floor(price / 1) * 1
  }
  if(price >= 10 && price < 100) {
    return Math.floor(price / 0.1) * 0.1
  }
  if(price >= 0 && price < 10) {
    return Math.floor(price / 0.01) * 0.01
  }
  return NaN
}

export async function allMarketCode(
  opt: {reg: RegExp, exceptWarnig: boolean} = {reg: /^KRW/, exceptWarnig: true}) {
  const res = (await api.getMarket(opt.exceptWarnig)).data
  return res.filter(m => opt.reg.test(m.market))
    .filter(m => {
      if(opt.exceptWarnig) {
        return m.market_warning === 'NONE'
      }
      return true
    }).map(m => m.market)
}

export async function tickers(codes: string[], sort?: string) {
  const res = (await api.getTicker({markets: codes})).data
  if(sort) {
    if(isNumber(res[0][sort])) {
      return res.sort((a, b) => b[sort] - a[sort])
    }
    if(isString(res[0][sort])) {
      return res.sort((a, b) => {
        const array = [a[sort], b[sort]].sort().reverse()
        if(array[0] === a[sort]) {
          return 1
        } else {
          return -1
        }
      })
    }
  }
  return res
}


export function agoMinutes(min: number, time: number = null) {
  if(time === null) {
    time = Date.now()
  }
  return new Date(time - (1000 * 60 * min))
}

export function agoHours(hours: number, time: number = null) {
  return agoMinutes(hours * 60)
}

export function isoDateTime(date: Date): string {
  const iso = format(date, 'isoDateTime')
  console.log(iso)
  return iso
}



export class OHLCMaker {
  private vector: I.OHLCType[] = []
  private preTime: number = -1
  private _limit: number

  constructor(limit: number) {
    this._limit = limit
  }

  get limit(): number {
    return this._limit
  }

  set limit(l: number) {
    this._limit = l
  }

  push(tr: I.TradeType) {
    if(this.preTime === -1) {
      if(tr.sequential_id % tr.trade_timestamp === 0) {
        this.preTime = tr.trade_timestamp
      } else {
        return
      }
    }
    const tt = Math.floor(tr.trade_timestamp / (1000 * 60)) * (1000 * 60)
    if(tt < this.preTime) {
      return
    }
    const price = tr.trade_price
    const volume = tr.trade_volume
    if(this.vector.length == 0) {
      this.vector.unshift(this.init(price, volume, tt))
      return
    }
    let latest = this.vector[0]
    if(tt > latest.timestamp) {
      for(let t = latest.timestamp + (1000 * 60); t < tt; t += (1000 * 60)) {
        this.vector.unshift(this.init(latest.close, 0, t))
      }
      this.vector.unshift(this.init(price, volume, tt))
      this.vector.splice(this.limit)
    } else {
      for(let i = 0; i < this.vector.length; i++) {
        if(this.vector[i].timestamp === tt) {
          const ohlc = this.vector[i]
          ohlc.high = Math.max(ohlc.high, price)
          ohlc.low = Math.min(ohlc.low, price)
          ohlc.volume += volume
          ohlc.close = price
          break
        }
      }
    }
  }

  as(minutes: number) {
    if((60 / minutes) !== Math.floor(60 / minutes)) {
      throw new Error(`'${minutes}'분봉은 구할 수 없다.`)
    }
    const os = this.vector.reduce((os: I.OHLCType[], o: I.OHLCType) => {
      const tt = Math.floor(o.timestamp / (minutes * 60 * 1000)) * (minutes * 60 * 1000)
      if(os.length === 0) {
        const merged = Object.assign({}, o)
        merged.timestamp = tt
        os.push(merged)
        return os
      }
      const oo = os[os.length - 1]
      if(oo.timestamp === tt) {
        oo.open = o.open
        oo.high = Math.max(oo.high, o.high)
        oo.low = Math.min(oo.low, o.low)
        oo.volume += o.volume
      } else {
        const merged = Object.assign({}, o)
        merged.timestamp = tt
        os.push(merged)
      }
      return os
    }, [])
    if(os.length !== 0) {
      if(os[os.length - 1].timestamp !== this.vector[this.vector.length - 1].timestamp) {
        os.pop()
      }
    }
    return os
  }

  get length() {
    return this.vector.length
  }

  private init(price: number, volume: number, timestamp: number): I.OHLCType {
    return {
      open: price,
      high: price,
      low: price,
      close: price,
      volume,
      timestamp,
    }
  }
}

export const api = new UPbit(getConfig('./config.json').upbit_keys)


const f = (): boolean => {
  return true
}

export function toTimeForR(t: number): string {
  const d = new Date(t)
  const date = (d.toISOString()).split('T')[0]
  const time = (d.toISOString()).split('T')[1].split('.')[0]
  return `${date} ${time}`
}
