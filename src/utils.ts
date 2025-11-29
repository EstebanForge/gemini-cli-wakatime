import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { StdioOptions } from 'child_process';

export function isWindows(): boolean {
  return os.platform() === 'win32';
}

export function getHomeDirectory(): string {
  let home = process.env.WAKATIME_HOME;
  if (home && home.trim() && fs.existsSync(home.trim())) return home.trim();
  return process.env[isWindows() ? 'USERPROFILE' : 'HOME'] || process.cwd();
}

export function buildOptions(stdin?: boolean): Object {
  const options: child_process.ExecFileOptions = {
    windowsHide: true,
  };
  if (stdin) {
    (options as any).stdio = ['pipe', 'pipe', 'pipe'] as StdioOptions;
  }
  if (!isWindows() && !process.env.WAKATIME_HOME && !process.env.HOME) {
    options['env'] = { ...process.env, WAKATIME_HOME: getHomeDirectory() };
  }
  return options;
}

export function formatArguments(binary: string, args: string[]): string {
  let clone = args.slice(0);
  clone.unshift(wrapArg(binary));
  let newCmds: string[] = [];
  let lastCmd = '';
  for (let i = 0; i < clone.length; i++) {
    if (lastCmd == '--key') newCmds.push(wrapArg(obfuscateKey(clone[i])));
    else newCmds.push(wrapArg(clone[i]));
    lastCmd = clone[i];
  }
  return newCmds.join(' ');
}

function wrapArg(arg: string): string {
  if (arg.indexOf(' ') > -1) return '"' + arg.replace(/"/g, '\\"') + '"';
  return arg;
}

function obfuscateKey(key: string): string {
  let newKey = '';
  if (key) {
    newKey = key;
    if (key.length > 4) newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
  }
  return newKey;
}
