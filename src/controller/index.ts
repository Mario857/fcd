import { KoaController } from 'koa-joi-controllers'
import config from 'config'

import TransactionController from './TransactionController'

const controllers = [TransactionController]
  .map((prototype) => {
    const controller = new prototype()

    controller.routes = controller.routes.filter((route) => {
      for (let i = 0; i < config.EXCLUDED_ROUTES.length; i += 1) {
        if (config.EXCLUDED_ROUTES[i].test(`${controller.prefix}${route.path}`)) {
          return false
        }
      }

      return true
    })

    // controller.routes.forEach((r) => logger.info(`Route: ${r.methods} ${controller.prefix}${r.path}`))
    return controller
  })
  .filter(Boolean) as KoaController[]

export default controllers
