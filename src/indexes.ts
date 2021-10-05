import {
  types as I,
} from './'



/**
 * 단순이동평균(simple moving average, SMA)
 * @param days 
 * @returns 
 */
export function SMA(days: number): (ohlc: I.OHLCType) => number {
  const mas: I.OHLCType[] = []
  return (ohlc: I.OHLCType): number => {
    if(mas.length === 0) {
      mas.push(ohlc)
    } else {
      if(mas[mas.length - 1].timestamp === ohlc.timestamp) {
        mas[mas.length - 1] = ohlc
      } else {
        mas.push(ohlc)
      }
      if(mas.length > days) {
        mas.splice(0, 1)
      }
    }
    return mas.reduce((p, o) => p + o.close, 0) / mas.length
  }
}


/**
 * 지수가중이동평균 (Exponentially weighted moving average, EWMA)
 * @param days 
 * @returns 
 */
export function EWMA(days: number): (ohlc: I.OHLCType) => number {
  let recent: I.OHLCType = null
  let ma: number = null
  return (ohlc: I.OHLCType): number => {
    if(recent === null) {
      recent = ohlc
      return ohlc.close
    }
    if(recent.timestamp !== ohlc.timestamp) {
      if(ma === null) {
        ma = recent.close
      } else {
        ma = ((1 - (1 / days)) * ma) + ((1 / days) * recent.close)
      }
      recent = ohlc
      return ((1 - (1 / days)) * ma) + ((1 / days) * ohlc.close)
    } else {
      recent = ohlc
      if(ma === null) {
        return ohlc.close
      } else {
        return ((1 - (1 / days)) * ma) + ((1 / days) * ohlc.close)
      }
    }
  }
}


/**
 * RSI(Relative Strength Index)
 * @param auFunc 
 * @param adFunc 
 * @returns 
 */
export function RSI(auFunc: (ohlc: I.OHLCType) => number, adFunc: (ohlc: I.OHLCType) => number)
: (ohlc: I.OHLCType) => number {
  let pre: I.OHLCType = null
  let recent: I.OHLCType = null
  return (ohlc: I.OHLCType): number => {
    if(pre === null || ohlc.timestamp === pre.timestamp) {
      pre = ohlc
      return 0.5
    }
    if(recent === null) {
      recent = ohlc
    }
    if(ohlc.timestamp !== recent.timestamp) {
      pre = recent
    }
    recent = ohlc
    const u: I.OHLCType = {
      timestamp: recent.timestamp,
      close: (recent.close > pre.close)? recent.close - pre.close : 0,
      open: null,
      high: null,
      low: null,
      volume: null,
    }
    const d: I.OHLCType = {
      timestamp: recent.timestamp,
      close: (recent.close < pre.close)? pre.close - recent.close : 0,
      open: null,
      high: null,
      low: null,
      volume: null,
    }
    const au = auFunc(u)
    const ad = adFunc(d)
    const rs = au / ad
    const rsi = rs / (1 + rs)
    return rsi
  }
}