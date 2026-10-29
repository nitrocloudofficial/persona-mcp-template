/**
 * Code Mode MCP Server
 *
 * Main entry point for the MCP server.
 */

import 'dotenv/config';
import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const server = await McpApplicationFactory.create(AppModule);
  const transport = (process.env.MCP_TRANSPORT_TYPE as any) || 'dual';
  const port = parseInt(process.env.PORT || '3005', 10);
  const host = process.env.HOST || '0.0.0.0';
  await server.start({
    transport,
    port,
    host,
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
