module.exports = {
  apps: [
    {
      name: 'collector',
      script: 'node run collector',
      watch: true,
      env: {
        TYPEORM_CONNECTION: 'postgres',
        TYPEORM_HOST: 'localhost',
        TYPEORM_USERNAME: 'dev',
        TYPEORM_PASSWORD: 'dev',
        TYPEORM_DATABASE: 'fcd',
        TYPEORM_PORT: '5432',
        TYPEORM_SYNCHRONIZE: 'true',
        TYPEORM_LOGGING: 'false',
        TYPEORM_ENTITIES: 'src/orm/*Entity.ts',
        TYPEORM_MIGRATIONS: 'src/orm/migration/*.ts',
        SERVER_PORT: '3060',
        CHAIN_ID: 'phoenix-1',
        LCD_URI: 'https://phoenix-lcd.terra.dev',
        FCD_URI: 'https://phoenix-fcd.terra.dev',
        RPC_URI: 'https://rpc.phoenix.terra.setten.io/357c6969055e4bebb81e0a52285cae52',
        SENTRY_DSN: ''
      }
    }
  ]
}
