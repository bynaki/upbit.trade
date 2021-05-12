import {
  readFileSync
} from 'fs'
import * as I from './types'
import {
  UPbit
} from 'cryptocurrency.api'


export function getConfig(fileName: string = './config.json'): I.Config {
  return JSON.parse((readFileSync(fileName)).toString())
}

export function floor(val: number, jari: number) {
  return Math.floor(val * Math.pow(10, jari)) / Math.pow(10, jari)
}

export function ceil(val: number, jari: number) {
  return Math.ceil(val * Math.pow(10, jari)) / Math.pow(10, jari)
}

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
  const api = new UPbit({
    accessKey: 'xxx',
    secretKey: 'xxx',
  })
  const res = (await api.getMarket(opt.exceptWarnig)).data
  return res.filter(m => opt.reg.test(m.market))
    .filter(m => {
      if(opt.exceptWarnig) {
        return m.market_warning === 'NONE'
      }
      return true
    }).map(m => m.market)
}