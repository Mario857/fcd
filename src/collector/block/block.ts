import * as sentry from '@sentry/node'
import { getRepository, getManager, DeepPartial, EntityManager } from 'typeorm'
import * as Bluebird from 'bluebird'
import { bech32 } from 'bech32'

import config from 'config'
import { BlockEntity } from 'orm'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import { getTxHashesFromBlock } from 'lib/tx'

import { collectTxs } from './tx'

const validatorCache = new Map()

export async function getValidatorOperatorAddressByConsensusAddress(b64: string, height: string) {
  const operatorAddress = validatorCache.get(b64)

  if (operatorAddress) {
    return operatorAddress
  }

  const valsAndCons = await lcd.getValidatorsAndConsensus('BOND_STATUS_BONDED', height)

  valsAndCons.forEach((v) => {
    if (v.lcdConsensus && v.lcdConsensus.address) {
      const b64i = Buffer.from(bech32.fromWords(bech32.decode(v.lcdConsensus.address).words)).toString('base64')

      validatorCache.set(b64i, v.lcdValidator.operator_address)
    }
  })

  if (!validatorCache.has(b64)) {
    throw new Error(`cannot find ${b64} address at height ${height}`)
  }

  return validatorCache.get(b64)
}

async function getLatestIndexedBlock(): Promise<BlockEntity | undefined> {
  const latestBlock = await getRepository(BlockEntity).find({
    where: {
      chainId: config.CHAIN_ID
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  if (!latestBlock || latestBlock.length === 0) {
    return
  }

  return latestBlock[0]
}

async function generateBlockEntity(lcdBlock: LcdBlock): Promise<DeepPartial<BlockEntity>> {
  const { chain_id: chainId, height, time: timestamp, proposer_address } = lcdBlock.block.header

  const blockEntity: DeepPartial<BlockEntity> = {
    chainId,
    height: +height,
    timestamp: new Date(timestamp),
    proposer: await getValidatorOperatorAddressByConsensusAddress(proposer_address, height)
  }

  return blockEntity
}

export async function saveBlockInformation(lcdBlock: LcdBlock): Promise<BlockEntity | undefined> {
  const height: string = lcdBlock.block.header.height
  logger.info(`collectBlock: begin transaction for block ${height}`)

  const result: BlockEntity | undefined = await getManager()
    .transaction(async (mgr: EntityManager) => {
      // Save block entity
      const newBlockEntity = await mgr.getRepository(BlockEntity).save(await generateBlockEntity(lcdBlock))
      // get block tx hashes
      const txHashes = getTxHashesFromBlock(lcdBlock)

      if (txHashes.length) {
        // save transactions
        await collectTxs(mgr, txHashes, newBlockEntity)
      }

      return newBlockEntity
    })
    .then((block: BlockEntity) => {
      logger.info('collectBlock: transaction finished')
      return block
    })
    .catch((err) => {
      logger.error(err)
      if (
        err instanceof Error &&
        typeof err.message === 'string' &&
        err.message.includes('transaction not found on node')
      ) {
        return undefined
      }
      sentry.captureException(err)
      return undefined
    })
  return result
}

export async function collectBlock(): Promise<void> {
  let latestHeight

  // Wait until it gets proper block
  while (!latestHeight) {
    const latestBlock = await lcd.getLatestBlock()

    if (latestBlock?.block) {
      latestHeight = Number(latestBlock.block.header.height)
      break
    }

    logger.info('collectBlock: waiting for the first block')
    await Bluebird.delay(1000)
  }

  let latestIndexedBlock = await getLatestIndexedBlock()
  let nextSyncHeight = latestIndexedBlock ? latestIndexedBlock.height + 1 : config.INITIAL_HEIGHT

  while (nextSyncHeight <= latestHeight) {
    const lcdBlock = await lcd.getBlock(nextSyncHeight.toString())

    if (!lcdBlock) {
      break
    }

    latestIndexedBlock = await saveBlockInformation(lcdBlock)

    // Exit the loop after transaction error whether there's more blocks or not
    if (!latestIndexedBlock) {
      break
    }

    nextSyncHeight = nextSyncHeight + 1
  }
}
