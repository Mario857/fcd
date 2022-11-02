import * as sentry from '@sentry/node'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher from 'lib/RPCWatcher'
import config from 'config'
import { collectBlock } from './block'

const SOCKET_URL = `${config.RPC_URI.replace('http', 'ws')}/websocket?key=cf65fc4a413a47639f623f80e67adb1b`
const NEW_BLOCK_Q = `tm.event='NewBlock'`

let blockUpdated = true

async function checkBlock() {
  if (!blockUpdated) {
    setTimeout(checkBlock, 50)
    return
  }

  blockUpdated = false
  await collectBlock().catch(sentry.captureException)
  setTimeout(checkBlock, 50)
}

export async function start() {
  let eventCounter = 0

  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(NEW_BLOCK_Q, async () => {
    eventCounter += 1
    blockUpdated = true
  })

  await watcher.start()

  const checkRestart = async () => {
    if (eventCounter === 0) {
      logger.info('watcher: event counter is zero. restarting..')
      watcher.restart()
      return
    }

    eventCounter = 0
    setTimeout(checkRestart, 20000)
  }

  setTimeout(checkRestart, 20000)
  setTimeout(checkBlock, 1000)
}
