import {
  readFileSync
} from 'fs'
import * as I from './types'


export function getConfig(fileName: string = './config.json'): I.Config {
  return JSON.parse((readFileSync(fileName)).toString())
}