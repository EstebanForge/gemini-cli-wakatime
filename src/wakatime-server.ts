#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Options } from './options';
import { Dependencies } from './dependencies';
import { logger, Logger, LogLevel } from './logger';

interface WakaTimeConfig {
  apiKey?: string;
  debug?: boolean;
}

interface HeartbeatState {
  lastHeartbeatAt: number;
  entities: Map<string, number>;
}

const STATE_FILE = path.join(os.homedir(), '.wakatime', 'gemini-cli.json');

class WakaTimeServer {
  private server: McpServer;
  private config: WakaTimeConfig = {};
  private state: HeartbeatState = { lastHeartbeatAt: 0, entities: new Map() };
  private options: Options;
  private deps: Dependencies;

  constructor() {
    this.server = new McpServer({
      name: 'wakatime',
      version: '1.0.0',
    });

    this.options = new Options();
    this.deps = new Dependencies(this.options, logger);
    this.loadConfig();
    this.loadState();
    this.deps.checkAndInstallCli();
    this.setupToolHandlers();
  }

  private loadConfig() {
    try {
      this.config.apiKey = this.options.getSetting('settings', 'api_key');
      const debug = this.options.getSetting('settings', 'debug');
      this.config.debug = debug === 'true';
      logger.setLevel(this.config.debug ? LogLevel.DEBUG : LogLevel.INFO);
    } catch (err) {
      logger.error('Failed to load WakaTime config: ' + err);
    }
  }

  private loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        this.state.lastHeartbeatAt = data.lastHeartbeatAt || 0;
        this.state.entities = new Map(Object.entries(data.entities || {}));
      }
    } catch (err) {
      logger.error('Failed to load state: ' + err);
      this.state = { lastHeartbeatAt: 0, entities: new Map() };
    }
  }

  private saveState() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      const entitiesObj = Object.fromEntries(this.state.entities);
      fs.writeFileSync(STATE_FILE, JSON.stringify({
        lastHeartbeatAt: this.state.lastHeartbeatAt,
        entities: entitiesObj,
      }, null, 2));
    } catch (err) {
      logger.error('Failed to save state: ' + err);
    }
  }

  private async sendHeartbeat(entity: string, lineChanges: number = 0) {
    if (!this.config.apiKey) {
      logger.error('WakaTime API key not configured. Please set it in ~/.wakatime.cfg');
      return;
    }

    const projectFolder = process.cwd();
    const args = [
      '--entity', entity,
      '--entity-type', 'file',
      '--category', 'ai coding',
      '--plugin', 'gemini-cli-wakatime/1.0.0',
    ];

    if (projectFolder) {
      args.push('--project-folder', projectFolder);
    }

    if (lineChanges !== 0) {
      args.push('--ai-line-changes', lineChanges.toString());
    }

    return new Promise<void>((resolve) => {
      const wakatimeCli = this.deps.getCliLocation();
      if (!fs.existsSync(wakatimeCli)) {
        logger.error('wakatime-cli not found. Auto-installation may be in progress.');
        resolve();
        return;
      }

      logger.debug(`Sending heartbeat for ${entity} with ${lineChanges} line changes`);

      const proc = spawn(wakatimeCli, args, {
        env: { ...process.env, WAKATIME_API_KEY: this.config.apiKey },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0 && this.config.debug) {
          logger.error(`wakatime-cli exited with code ${code}: ${output}`);
        } else if (code === 0) {
          logger.debug('Heartbeat sent successfully');
        }
        resolve();
      });
    });
  }

  private shouldSendHeartbeat(): boolean {
    const now = Date.now() / 1000;
    return now - this.state.lastHeartbeatAt >= 60;
  }

  private updateLastHeartbeat() {
    this.state.lastHeartbeatAt = Date.now() / 1000;
  }

  public async handleFileOperation(filePath: string, operation: 'read' | 'write' | 'edit') {
    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      if (operation === 'write' || operation === 'edit') {
        const lineChanges = await this.getLineChanges(filePath);
        this.state.entities.set(filePath, (this.state.entities.get(filePath) || 0) + lineChanges);
      }

      if (this.shouldSendHeartbeat()) {
        for (const [entity, changes] of this.state.entities.entries()) {
          await this.sendHeartbeat(entity, changes);
        }
        this.updateLastHeartbeat();
        this.state.entities.clear();
        this.saveState();
      }
    } catch (err) {
      logger.error('Failed to handle file operation: ' + err);
    }
  }

  private async getLineChanges(filePath: string): Promise<number> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      return lines;
    } catch {
      return 0;
    }
  }

  private setupToolHandlers() {
    this.server.registerTool(
      'track_file_operation',
      {
        description: 'Track file read/write/edit operations for WakaTime',
        inputSchema: {},
      },
      async (args: any) => {
        try {
          const operation = args.operation || 'read';
          const file_path = args.file_path || '';

          await this.handleFileOperation(file_path, operation);
          return {
            content: [
              {
                type: 'text',
                text: `Tracked ${operation} operation for ${file_path}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to track file operation: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('WakaTime MCP Server started and connected');
  }
}

const server = new WakaTimeServer();
server.run().catch(console.error);