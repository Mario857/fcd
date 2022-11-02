import { init as initORM } from 'orm'
import { get } from 'lodash'

import { collectorLogger as logger } from 'lib/logger'
import { init as initErrorReport } from 'lib/errorReport'

import { collectBlock } from './block'
import { start as startWatcher } from './watcher'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const init = async () => {
  initErrorReport()
  await initORM()
  await collectBlock()
  await startWatcher()
}

init().catch(logger.error)
