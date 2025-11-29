"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWindows = isWindows;
exports.getHomeDirectory = getHomeDirectory;
exports.buildOptions = buildOptions;
exports.formatArguments = formatArguments;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
function isWindows() {
    return os.platform() === 'win32';
}
function getHomeDirectory() {
    let home = process.env.WAKATIME_HOME;
    if (home && home.trim() && fs.existsSync(home.trim()))
        return home.trim();
    return process.env[isWindows() ? 'USERPROFILE' : 'HOME'] || process.cwd();
}
function buildOptions(stdin) {
    const options = {
        windowsHide: true,
    };
    if (stdin) {
        options.stdio = ['pipe', 'pipe', 'pipe'];
    }
    if (!isWindows() && !process.env.WAKATIME_HOME && !process.env.HOME) {
        options['env'] = { ...process.env, WAKATIME_HOME: getHomeDirectory() };
    }
    return options;
}
function formatArguments(binary, args) {
    let clone = args.slice(0);
    clone.unshift(wrapArg(binary));
    let newCmds = [];
    let lastCmd = '';
    for (let i = 0; i < clone.length; i++) {
        if (lastCmd == '--key')
            newCmds.push(wrapArg(obfuscateKey(clone[i])));
        else
            newCmds.push(wrapArg(clone[i]));
        lastCmd = clone[i];
    }
    return newCmds.join(' ');
}
function wrapArg(arg) {
    if (arg.indexOf(' ') > -1)
        return '"' + arg.replace(/"/g, '\\"') + '"';
    return arg;
}
function obfuscateKey(key) {
    let newKey = '';
    if (key) {
        newKey = key;
        if (key.length > 4)
            newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
    }
    return newKey;
}
