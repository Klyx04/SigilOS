"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/dotenv/package.json
var require_package = __commonJS({
  "node_modules/dotenv/package.json"(exports2, module2) {
    module2.exports = {
      name: "dotenv",
      version: "17.3.1",
      description: "Loads environment variables from .env file",
      main: "lib/main.js",
      types: "lib/main.d.ts",
      exports: {
        ".": {
          types: "./lib/main.d.ts",
          require: "./lib/main.js",
          default: "./lib/main.js"
        },
        "./config": "./config.js",
        "./config.js": "./config.js",
        "./lib/env-options": "./lib/env-options.js",
        "./lib/env-options.js": "./lib/env-options.js",
        "./lib/cli-options": "./lib/cli-options.js",
        "./lib/cli-options.js": "./lib/cli-options.js",
        "./package.json": "./package.json"
      },
      scripts: {
        "dts-check": "tsc --project tests/types/tsconfig.json",
        lint: "standard",
        pretest: "npm run lint && npm run dts-check",
        test: "tap run tests/**/*.js --allow-empty-coverage --disable-coverage --timeout=60000",
        "test:coverage": "tap run tests/**/*.js --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
        prerelease: "npm test",
        release: "standard-version"
      },
      repository: {
        type: "git",
        url: "git://github.com/motdotla/dotenv.git"
      },
      homepage: "https://github.com/motdotla/dotenv#readme",
      funding: "https://dotenvx.com",
      keywords: [
        "dotenv",
        "env",
        ".env",
        "environment",
        "variables",
        "config",
        "settings"
      ],
      readmeFilename: "README.md",
      license: "BSD-2-Clause",
      devDependencies: {
        "@types/node": "^18.11.3",
        decache: "^4.6.2",
        sinon: "^14.0.1",
        standard: "^17.0.0",
        "standard-version": "^9.5.0",
        tap: "^19.2.0",
        typescript: "^4.8.4"
      },
      engines: {
        node: ">=12"
      },
      browser: {
        fs: false
      }
    };
  }
});

// node_modules/dotenv/lib/main.js
var require_main = __commonJS({
  "node_modules/dotenv/lib/main.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var crypto = require("crypto");
    var packageJson = require_package();
    var version = packageJson.version;
    var TIPS = [
      "\u{1F510} encrypt with Dotenvx: https://dotenvx.com",
      "\u{1F510} prevent committing .env to code: https://dotenvx.com/precommit",
      "\u{1F510} prevent building .env in docker: https://dotenvx.com/prebuild",
      "\u{1F916} agentic secret storage: https://dotenvx.com/as2",
      "\u26A1\uFE0F secrets for agents: https://dotenvx.com/as2",
      "\u{1F6E1}\uFE0F auth for agents: https://vestauth.com",
      "\u{1F6E0}\uFE0F  run anywhere with `dotenvx run -- yourcommand`",
      "\u2699\uFE0F  specify custom .env file path with { path: '/custom/path/.env' }",
      "\u2699\uFE0F  enable debug logging with { debug: true }",
      "\u2699\uFE0F  override existing env vars with { override: true }",
      "\u2699\uFE0F  suppress all logs with { quiet: true }",
      "\u2699\uFE0F  write to custom object with { processEnv: myObject }",
      "\u2699\uFE0F  load multiple .env files with { path: ['.env.local', '.env'] }"
    ];
    function _getRandomTip() {
      return TIPS[Math.floor(Math.random() * TIPS.length)];
    }
    function parseBoolean(value) {
      if (typeof value === "string") {
        return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
      }
      return Boolean(value);
    }
    function supportsAnsi() {
      return process.stdout.isTTY;
    }
    function dim(text) {
      return supportsAnsi() ? `\x1B[2m${text}\x1B[0m` : text;
    }
    var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
    function parse(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/mg, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++) {
        try {
          const key = keys[i].trim();
          const attrs = _instructions(result, key);
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) {
            throw error;
          }
        }
      }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.error(`[dotenv@${version}][WARN] ${message}`);
    }
    function _debug(message) {
      console.log(`[dotenv@${version}][DEBUG] ${message}`);
    }
    function _log(message) {
      console.log(`[dotenv@${version}] ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
        return options.DOTENV_KEY;
      }
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
        return process.env.DOTENV_KEY;
      }
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = new Error("INVALID_DOTENV_KEY: Missing key part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return { ciphertext, key };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0) {
        if (Array.isArray(options.path)) {
          for (const filepath of options.path) {
            if (fs.existsSync(filepath)) {
              possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
            }
          }
        } else {
          possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
        }
      } else {
        possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
      }
      if (fs.existsSync(possibleVaultPath)) {
        return possibleVaultPath;
      }
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
    }
    function _configVault(options) {
      const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
      const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
      if (debug || !quiet) {
        _log("Loading env from encrypted .env.vault");
      }
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
      let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
      if (options && options.encoding) {
        encoding = options.encoding;
      } else {
        if (debug) {
          _debug("No encoding is specified. UTF-8 is used by default");
        }
      }
      let optionPaths = [dotenvPath];
      if (options && options.path) {
        if (!Array.isArray(options.path)) {
          optionPaths = [_resolveHome(options.path)];
        } else {
          optionPaths = [];
          for (const filepath of options.path) {
            optionPaths.push(_resolveHome(filepath));
          }
        }
      }
      let lastError;
      const parsedAll = {};
      for (const path2 of optionPaths) {
        try {
          const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${path2} ${e.message}`);
          }
          lastError = e;
        }
      }
      const populated = DotenvModule.populate(processEnv, parsedAll, options);
      debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
      quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
      if (debug || !quiet) {
        const keysCount = Object.keys(populated).length;
        const shortPaths = [];
        for (const filePath of optionPaths) {
          try {
            const relative = path.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) {
              _debug(`Failed to load ${filePath} ${e.message}`);
            }
            lastError = e;
          }
        }
        _log(`injecting env (${keysCount}) from ${shortPaths.join(",")} ${dim(`-- tip: ${_getRandomTip()}`)}`);
      }
      if (lastError) {
        return { parsed: parsedAll, error: lastError };
      } else {
        return { parsed: parsedAll };
      }
    }
    function config(options) {
      if (_dotenvKey(options).length === 0) {
        return DotenvModule.configDotenv(options);
      }
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else {
          throw error;
        }
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      const populated = {};
      if (typeof parsed !== "object") {
        const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed)) {
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
            populated[key] = parsed[key];
          }
          if (debug) {
            if (override === true) {
              _debug(`"${key}" is already defined and WAS overwritten`);
            } else {
              _debug(`"${key}" is already defined and was NOT overwritten`);
            }
          }
        } else {
          processEnv[key] = parsed[key];
          populated[key] = parsed[key];
        }
      }
      return populated;
    }
    var DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config,
      decrypt,
      parse,
      populate
    };
    module2.exports.configDotenv = DotenvModule.configDotenv;
    module2.exports._configVault = DotenvModule._configVault;
    module2.exports._parseVault = DotenvModule._parseVault;
    module2.exports.config = DotenvModule.config;
    module2.exports.decrypt = DotenvModule.decrypt;
    module2.exports.parse = DotenvModule.parse;
    module2.exports.populate = DotenvModule.populate;
    module2.exports = DotenvModule;
  }
});

// node_modules/dotenv/lib/env-options.js
var require_env_options = __commonJS({
  "node_modules/dotenv/lib/env-options.js"(exports2, module2) {
    var options = {};
    if (process.env.DOTENV_CONFIG_ENCODING != null) {
      options.encoding = process.env.DOTENV_CONFIG_ENCODING;
    }
    if (process.env.DOTENV_CONFIG_PATH != null) {
      options.path = process.env.DOTENV_CONFIG_PATH;
    }
    if (process.env.DOTENV_CONFIG_QUIET != null) {
      options.quiet = process.env.DOTENV_CONFIG_QUIET;
    }
    if (process.env.DOTENV_CONFIG_DEBUG != null) {
      options.debug = process.env.DOTENV_CONFIG_DEBUG;
    }
    if (process.env.DOTENV_CONFIG_OVERRIDE != null) {
      options.override = process.env.DOTENV_CONFIG_OVERRIDE;
    }
    if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) {
      options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
    }
    module2.exports = options;
  }
});

// node_modules/dotenv/lib/cli-options.js
var require_cli_options = __commonJS({
  "node_modules/dotenv/lib/cli-options.js"(exports2, module2) {
    var re = /^dotenv_config_(encoding|path|quiet|debug|override|DOTENV_KEY)=(.+)$/;
    module2.exports = function optionMatcher(args) {
      const options = args.reduce(function(acc, cur) {
        const matches2 = cur.match(re);
        if (matches2) {
          acc[matches2[1]] = matches2[2];
        }
        return acc;
      }, {});
      if (!("quiet" in options)) {
        options.quiet = "true";
      }
      return options;
    };
  }
});

// node_modules/uid2/index.js
var require_uid2 = __commonJS({
  "node_modules/uid2/index.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var UIDCHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    function tostr(bytes) {
      var r = "", i;
      for (i = 0; i < bytes.length; i++) {
        r += UIDCHARS[bytes[i] % 64];
      }
      return r;
    }
    function uid(length, cb) {
      if (typeof cb === "undefined") {
        return tostr(crypto.randomBytes(length));
      } else {
        crypto.randomBytes(length, function(err, bytes) {
          if (err) return cb(err);
          cb(null, tostr(bytes));
        });
      }
    }
    module2.exports = uid;
  }
});

// node_modules/notepack.io/lib/encode.js
var require_encode = __commonJS({
  "node_modules/notepack.io/lib/encode.js"(exports2, module2) {
    "use strict";
    var MICRO_OPT_LEN = 32;
    var TIMESTAMP32_MAX_SEC = 4294967296 - 1;
    var TIMESTAMP64_MAX_SEC = 17179869184 - 1;
    function utf8Write(arr, offset, str) {
      let c = 0;
      for (let i = 0, l = str.length; i < l; i++) {
        c = str.charCodeAt(i);
        if (c < 128) {
          arr[offset++] = c;
        } else if (c < 2048) {
          arr[offset++] = 192 | c >> 6;
          arr[offset++] = 128 | c & 63;
        } else if (c < 55296 || c >= 57344) {
          arr[offset++] = 224 | c >> 12;
          arr[offset++] = 128 | c >> 6 & 63;
          arr[offset++] = 128 | c & 63;
        } else {
          i++;
          c = 65536 + ((c & 1023) << 10 | str.charCodeAt(i) & 1023);
          arr[offset++] = 240 | c >> 18;
          arr[offset++] = 128 | c >> 12 & 63;
          arr[offset++] = 128 | c >> 6 & 63;
          arr[offset++] = 128 | c & 63;
        }
      }
    }
    function utf8Length(str) {
      let c = 0, length = 0;
      for (let i = 0, l = str.length; i < l; i++) {
        c = str.charCodeAt(i);
        if (c < 128) {
          length += 1;
        } else if (c < 2048) {
          length += 2;
        } else if (c < 55296 || c >= 57344) {
          length += 3;
        } else {
          i++;
          length += 4;
        }
      }
      return length;
    }
    var cache2 = /* @__PURE__ */ new Map();
    var cacheMaxSize = process.env.NOTEPACK_ENCODE_CACHE_MAX_SIZE || 1024;
    function encodeKey(bytes, defers, key) {
      if (cache2.has(key)) {
        const buffer = cache2.get(key);
        defers.push({ bin: buffer, length: buffer.length, offset: bytes.length });
        return buffer.length;
      }
      if (cache2.size > cacheMaxSize) {
        return _encode(bytes, defers, key);
      }
      const keyBytes = [];
      const size = _encode(keyBytes, [], key);
      const keyBuffer = Buffer.allocUnsafe(size);
      for (let i = 0, l = keyBytes.length; i < l; i++) {
        keyBuffer[i] = keyBytes[i];
      }
      utf8Write(keyBuffer, keyBytes.length, key);
      defers.push({ bin: keyBuffer, length: size, offset: bytes.length });
      cache2.set(key, keyBuffer);
      return size;
    }
    function _encode(bytes, defers, value) {
      let hi = 0, lo = 0, length = 0, size = 0;
      switch (typeof value) {
        case "string":
          if (value.length > MICRO_OPT_LEN) {
            length = Buffer.byteLength(value);
          } else {
            length = utf8Length(value);
          }
          if (length < 32) {
            bytes.push(length | 160);
            size = 1;
          } else if (length < 256) {
            bytes.push(217, length);
            size = 2;
          } else if (length < 65536) {
            bytes.push(218, length >> 8, length);
            size = 3;
          } else if (length < 4294967296) {
            bytes.push(219, length >> 24, length >> 16, length >> 8, length);
            size = 5;
          } else {
            throw new Error("String too long");
          }
          defers.push({ str: value, length, offset: bytes.length });
          return size + length;
        case "number":
          if (Math.floor(value) !== value || !isFinite(value)) {
            bytes.push(203);
            defers.push({ float: value, length: 8, offset: bytes.length });
            return 9;
          }
          if (value >= 0) {
            if (value < 128) {
              bytes.push(value);
              return 1;
            }
            if (value < 256) {
              bytes.push(204, value);
              return 2;
            }
            if (value < 65536) {
              bytes.push(205, value >> 8, value);
              return 3;
            }
            if (value < 4294967296) {
              bytes.push(206, value >> 24, value >> 16, value >> 8, value);
              return 5;
            }
            hi = value / Math.pow(2, 32) >> 0;
            lo = value >>> 0;
            bytes.push(207, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
            return 9;
          } else {
            if (value >= -32) {
              bytes.push(value);
              return 1;
            }
            if (value >= -128) {
              bytes.push(208, value);
              return 2;
            }
            if (value >= -32768) {
              bytes.push(209, value >> 8, value);
              return 3;
            }
            if (value >= -2147483648) {
              bytes.push(210, value >> 24, value >> 16, value >> 8, value);
              return 5;
            }
            hi = Math.floor(value / Math.pow(2, 32));
            lo = value >>> 0;
            bytes.push(211, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
            return 9;
          }
          break;
        case "object":
          if (value === null) {
            bytes.push(192);
            return 1;
          }
          if (Array.isArray(value)) {
            length = value.length;
            if (length < 16) {
              bytes.push(length | 144);
              size = 1;
            } else if (length < 65536) {
              bytes.push(220, length >> 8, length);
              size = 3;
            } else if (length < 4294967296) {
              bytes.push(221, length >> 24, length >> 16, length >> 8, length);
              size = 5;
            } else {
              throw new Error("Array too large");
            }
            for (let i = 0; i < length; i++) {
              size += _encode(bytes, defers, value[i]);
            }
            return size;
          }
          if (value instanceof Date) {
            const ms = value.getTime();
            const s = Math.floor(ms / 1e3);
            const ns = (ms - s * 1e3) * 1e6;
            if (s >= 0 && ns >= 0 && s <= TIMESTAMP64_MAX_SEC) {
              if (ns === 0 && s <= TIMESTAMP32_MAX_SEC) {
                bytes.push(214, 255, s >> 24, s >> 16, s >> 8, s);
                return 6;
              } else {
                hi = s / 4294967296;
                lo = s & 4294967295;
                bytes.push(215, 255, ns >> 22, ns >> 14, ns >> 6, hi, lo >> 24, lo >> 16, lo >> 8, lo);
                return 10;
              }
            } else {
              hi = Math.floor(s / 4294967296);
              lo = s >>> 0;
              bytes.push(199, 12, 255, ns >> 24, ns >> 16, ns >> 8, ns, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
              return 15;
            }
          }
          if (value instanceof Buffer) {
            length = value.length;
            if (length < 256) {
              bytes.push(196, length);
              size = 2;
            } else if (length < 65536) {
              bytes.push(197, length >> 8, length);
              size = 3;
            } else if (length < 4294967296) {
              bytes.push(198, length >> 24, length >> 16, length >> 8, length);
              size = 5;
            } else {
              throw new Error("Buffer too large");
            }
            defers.push({ bin: value, length, offset: bytes.length });
            return size + length;
          }
          if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            return _encode(bytes, defers, Buffer.from(value));
          }
          if (typeof value.toJSON === "function") {
            return _encode(bytes, defers, value.toJSON());
          }
          const keys = [], allKeys = Object.keys(value);
          let key = "";
          for (let i = 0, l = allKeys.length; i < l; i++) {
            key = allKeys[i];
            if (value[key] !== void 0 && typeof value[key] !== "function") {
              keys.push(key);
            }
          }
          length = keys.length;
          if (length < 16) {
            bytes.push(length | 128);
            size = 1;
          } else if (length < 65536) {
            bytes.push(222, length >> 8, length);
            size = 3;
          } else if (length < 4294967296) {
            bytes.push(223, length >> 24, length >> 16, length >> 8, length);
            size = 5;
          } else {
            throw new Error("Object too large");
          }
          for (let i = 0; i < length; i++) {
            key = keys[i];
            size += encodeKey(bytes, defers, key);
            size += _encode(bytes, defers, value[key]);
          }
          return size;
        case "boolean":
          bytes.push(value ? 195 : 194);
          return 1;
        case "undefined":
          bytes.push(192);
          return 1;
        default:
          if (typeof value.toJSON === "function") {
            return _encode(bytes, defers, value.toJSON());
          }
          throw new Error("Could not encode");
      }
    }
    function encode(value) {
      const bytes = [], defers = [], size = _encode(bytes, defers, value);
      const buf = Buffer.allocUnsafe(size);
      let deferIndex = 0, deferWritten = 0, nextOffset = -1;
      if (defers.length > 0) {
        nextOffset = defers[0].offset;
      }
      let defer, deferLength = 0, offset = 0;
      for (let i = 0, l = bytes.length; i < l; i++) {
        buf[deferWritten + i] = bytes[i];
        while (i + 1 === nextOffset) {
          defer = defers[deferIndex];
          deferLength = defer.length;
          offset = deferWritten + nextOffset;
          if (defer.bin) {
            if (deferLength > MICRO_OPT_LEN) {
              defer.bin.copy(buf, offset, 0, deferLength);
            } else {
              const bin = defer.bin;
              for (let j = 0; j < deferLength; j++) {
                buf[offset + j] = bin[j];
              }
            }
          } else if (defer.str) {
            if (deferLength > MICRO_OPT_LEN) {
              buf.write(defer.str, offset, deferLength, "utf8");
            } else {
              utf8Write(buf, offset, defer.str);
            }
          } else if (defer.float !== void 0) {
            buf.writeDoubleBE(defer.float, offset);
          }
          deferIndex++;
          deferWritten += deferLength;
          if (defers[deferIndex]) {
            nextOffset = defers[deferIndex].offset;
          } else {
            break;
          }
        }
      }
      return buf;
    }
    module2.exports = encode;
  }
});

// node_modules/notepack.io/lib/DecodeKeyCache.js
var require_DecodeKeyCache = __commonJS({
  "node_modules/notepack.io/lib/DecodeKeyCache.js"(exports2, module2) {
    var DEFAULT_MAX_SIZE = process.env.NOTEPACK_DECODE_KEY_CACHE_MAX_SIZE || 1024;
    var DEFAULT_MAX_LENGTH = process.env.NOTEPACK_DECODE_KEY_CACHE_MAX_LENGTH || 16;
    var DecodeKeyCache = class {
      constructor({ maxSize = DEFAULT_MAX_SIZE, maxLength = DEFAULT_MAX_LENGTH } = {}) {
        this.size = 0;
        this.maxSize = maxSize;
        this.maxLength = maxLength;
        this.cache = /* @__PURE__ */ new Map();
        for (let i = 1; i <= this.maxLength; i++) {
          this.cache.set(i, /* @__PURE__ */ new Map());
        }
      }
      get(buffer, offset, length) {
        if (length > this.maxLength) {
          return false;
        }
        let node = this.cache.get(length);
        for (let i = 0; i < length; i++) {
          const byte = buffer[offset + i];
          if (node.has(byte)) {
            node = node.get(byte);
          } else {
            return false;
          }
        }
        return node;
      }
      set(buffer, offset, length, value) {
        if (length > this.maxLength || this.size >= this.maxSize) {
          return;
        }
        this.size++;
        let node = this.cache.get(length);
        for (let i = 0; i < length; i++) {
          const byte = buffer[offset + i];
          if (i === length - 1) {
            node.set(byte, value);
          } else if (node.has(byte)) {
            node = node.get(byte);
          } else {
            const newNode = /* @__PURE__ */ new Map();
            node.set(byte, newNode);
            node = newNode;
          }
        }
      }
    };
    module2.exports = DecodeKeyCache;
  }
});

// node_modules/notepack.io/lib/decode.js
var require_decode = __commonJS({
  "node_modules/notepack.io/lib/decode.js"(exports2, module2) {
    "use strict";
    var DecodeKeyCache = require_DecodeKeyCache();
    var cache2 = new DecodeKeyCache();
    function Decoder(buffer) {
      this.offset = 0;
      this.buffer = buffer;
      this.useKeyCache = false;
    }
    Decoder.prototype.array = function(length) {
      const value = new Array(length);
      for (let i = 0; i < length; i++) {
        value[i] = this.parse();
      }
      return value;
    };
    Decoder.prototype.map = function(length) {
      let key = "", value = {};
      for (let i = 0; i < length; i++) {
        this.useKeyCache = true;
        key = this.parse();
        this.useKeyCache = false;
        value[key] = this.parse();
      }
      return value;
    };
    Decoder.prototype.str = function(length) {
      if (this.useKeyCache) {
        const valueFromCache = cache2.get(this.buffer, this.offset, length);
        if (valueFromCache) {
          this.offset += length;
          return valueFromCache;
        }
      }
      const value = this.buffer.toString("utf8", this.offset, this.offset + length);
      if (this.useKeyCache) {
        cache2.set(this.buffer, this.offset, length, value);
      }
      this.offset += length;
      return value;
    };
    Decoder.prototype.bin = function(length) {
      const value = this.buffer.slice(this.offset, this.offset + length);
      this.offset += length;
      return value;
    };
    Decoder.prototype.arraybuffer = function(length) {
      const buffer = new ArrayBuffer(length);
      const view = new Uint8Array(buffer);
      for (let j = 0; j < length; j++) {
        view[j] = this.buffer[this.offset + j];
      }
      this.offset += length;
      return buffer;
    };
    Decoder.prototype.parse = function() {
      const prefix = this.buffer[this.offset++];
      let value, length = 0, type = 0, hi = 0, lo = 0;
      if (prefix < 192) {
        if (prefix < 128) {
          return prefix;
        }
        if (prefix < 144) {
          return this.map(prefix & 15);
        }
        if (prefix < 160) {
          return this.array(prefix & 15);
        }
        return this.str(prefix & 31);
      }
      if (prefix > 223) {
        return (255 - prefix + 1) * -1;
      }
      switch (prefix) {
        // nil
        case 192:
          return null;
        // false
        case 194:
          return false;
        // true
        case 195:
          return true;
        // bin
        case 196:
          length = this.buffer.readUInt8(this.offset);
          this.offset += 1;
          return this.bin(length);
        case 197:
          length = this.buffer.readUInt16BE(this.offset);
          this.offset += 2;
          return this.bin(length);
        case 198:
          length = this.buffer.readUInt32BE(this.offset);
          this.offset += 4;
          return this.bin(length);
        // ext
        case 199:
          length = this.buffer.readUInt8(this.offset);
          type = this.buffer.readInt8(this.offset + 1);
          this.offset += 2;
          if (type === 0) {
            return this.arraybuffer(length);
          }
          if (type === -1) {
            const ns = this.buffer.readUInt32BE(this.offset);
            hi = this.buffer.readInt32BE(this.offset + 4);
            lo = this.buffer.readUInt32BE(this.offset + 8);
            this.offset += 12;
            return new Date((hi * 4294967296 + lo) * 1e3 + ns / 1e6);
          }
          return [type, this.bin(length)];
        case 200:
          length = this.buffer.readUInt16BE(this.offset);
          type = this.buffer.readInt8(this.offset + 2);
          this.offset += 3;
          if (type === 0) {
            return this.arraybuffer(length);
          }
          return [type, this.bin(length)];
        case 201:
          length = this.buffer.readUInt32BE(this.offset);
          type = this.buffer.readInt8(this.offset + 4);
          this.offset += 5;
          if (type === 0) {
            return this.arraybuffer(length);
          }
          return [type, this.bin(length)];
        // float
        case 202:
          value = this.buffer.readFloatBE(this.offset);
          this.offset += 4;
          return value;
        case 203:
          value = this.buffer.readDoubleBE(this.offset);
          this.offset += 8;
          return value;
        // uint
        case 204:
          value = this.buffer.readUInt8(this.offset);
          this.offset += 1;
          return value;
        case 205:
          value = this.buffer.readUInt16BE(this.offset);
          this.offset += 2;
          return value;
        case 206:
          value = this.buffer.readUInt32BE(this.offset);
          this.offset += 4;
          return value;
        case 207:
          hi = this.buffer.readUInt32BE(this.offset) * Math.pow(2, 32);
          lo = this.buffer.readUInt32BE(this.offset + 4);
          this.offset += 8;
          return hi + lo;
        // int
        case 208:
          value = this.buffer.readInt8(this.offset);
          this.offset += 1;
          return value;
        case 209:
          value = this.buffer.readInt16BE(this.offset);
          this.offset += 2;
          return value;
        case 210:
          value = this.buffer.readInt32BE(this.offset);
          this.offset += 4;
          return value;
        case 211:
          hi = this.buffer.readInt32BE(this.offset) * Math.pow(2, 32);
          lo = this.buffer.readUInt32BE(this.offset + 4);
          this.offset += 8;
          return hi + lo;
        // fixext
        case 212:
          type = this.buffer.readInt8(this.offset);
          this.offset += 1;
          if (type === 0) {
            this.offset += 1;
            return void 0;
          }
          return [type, this.bin(1)];
        case 213:
          type = this.buffer.readInt8(this.offset);
          this.offset += 1;
          return [type, this.bin(2)];
        case 214:
          type = this.buffer.readInt8(this.offset);
          this.offset += 1;
          if (type === -1) {
            value = this.buffer.readUInt32BE(this.offset);
            this.offset += 4;
            return new Date(value * 1e3);
          }
          return [type, this.bin(4)];
        case 215:
          type = this.buffer.readInt8(this.offset);
          this.offset += 1;
          if (type === 0) {
            hi = this.buffer.readInt32BE(this.offset) * Math.pow(2, 32);
            lo = this.buffer.readUInt32BE(this.offset + 4);
            this.offset += 8;
            return new Date(hi + lo);
          }
          if (type === -1) {
            hi = this.buffer.readUInt32BE(this.offset);
            lo = this.buffer.readUInt32BE(this.offset + 4);
            this.offset += 8;
            const s = (hi & 3) * 4294967296 + lo;
            return new Date(s * 1e3 + (hi >>> 2) / 1e6);
          }
          return [type, this.bin(8)];
        case 216:
          type = this.buffer.readInt8(this.offset);
          this.offset += 1;
          return [type, this.bin(16)];
        // str
        case 217:
          length = this.buffer.readUInt8(this.offset);
          this.offset += 1;
          return this.str(length);
        case 218:
          length = this.buffer.readUInt16BE(this.offset);
          this.offset += 2;
          return this.str(length);
        case 219:
          length = this.buffer.readUInt32BE(this.offset);
          this.offset += 4;
          return this.str(length);
        // array
        case 220:
          length = this.buffer.readUInt16BE(this.offset);
          this.offset += 2;
          return this.array(length);
        case 221:
          length = this.buffer.readUInt32BE(this.offset);
          this.offset += 4;
          return this.array(length);
        // map
        case 222:
          length = this.buffer.readUInt16BE(this.offset);
          this.offset += 2;
          return this.map(length);
        case 223:
          length = this.buffer.readUInt32BE(this.offset);
          this.offset += 4;
          return this.map(length);
      }
      throw new Error("Could not parse");
    };
    function decode(buffer) {
      const decoder = new Decoder(buffer);
      const value = decoder.parse();
      if (decoder.offset !== buffer.length) {
        throw new Error(buffer.length - decoder.offset + " trailing bytes");
      }
      return value;
    }
    module2.exports = decode;
  }
});

// node_modules/notepack.io/lib/index.js
var require_lib = __commonJS({
  "node_modules/notepack.io/lib/index.js"(exports2) {
    exports2.encode = require_encode();
    exports2.decode = require_decode();
  }
});

// node_modules/socket.io-adapter/dist/contrib/yeast.js
var require_yeast = __commonJS({
  "node_modules/socket.io-adapter/dist/contrib/yeast.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.encode = encode;
    exports2.decode = decode;
    exports2.yeast = yeast;
    var alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split("");
    var length = 64;
    var map = {};
    var seed = 0;
    var i = 0;
    var prev;
    function encode(num) {
      let encoded = "";
      do {
        encoded = alphabet[num % length] + encoded;
        num = Math.floor(num / length);
      } while (num > 0);
      return encoded;
    }
    function decode(str) {
      let decoded = 0;
      for (i = 0; i < str.length; i++) {
        decoded = decoded * length + map[str.charAt(i)];
      }
      return decoded;
    }
    function yeast() {
      const now = encode(+/* @__PURE__ */ new Date());
      if (now !== prev)
        return seed = 0, prev = now;
      return now + "." + encode(seed++);
    }
    for (; i < length; i++)
      map[alphabet[i]] = i;
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver;
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http = require("http");
    var net = require("net");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL: URL2 } = require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver = require_receiver();
    var Sender = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var closeTimeout = 30 * 1e3;
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket.prototype.addEventListener = addEventListener;
    WebSocket.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket.CLOSED) return;
      if (websocket.readyState === WebSocket.OPEN) {
        websocket._readyState = WebSocket.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket.CLOSING;
      let chunk;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk = websocket._socket.read()) !== null) {
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket();
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream;
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/socket.io-adapter/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket = require_websocket();
    var { GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module2.exports = WebSocketServer;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// node_modules/socket.io-adapter/node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/socket.io-adapter/node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket();
    WebSocket.createWebSocketStream = require_stream();
    WebSocket.Server = require_websocket_server();
    WebSocket.Receiver = require_receiver();
    WebSocket.Sender = require_sender();
    WebSocket.WebSocket = WebSocket;
    WebSocket.WebSocketServer = WebSocket.Server;
    module2.exports = WebSocket;
  }
});

// node_modules/socket.io-adapter/dist/in-memory-adapter.js
var require_in_memory_adapter = __commonJS({
  "node_modules/socket.io-adapter/dist/in-memory-adapter.js"(exports2) {
    "use strict";
    var _a;
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SessionAwareAdapter = exports2.Adapter = void 0;
    var events_1 = require("events");
    var yeast_1 = require_yeast();
    var WebSocket = require_ws();
    var canPreComputeFrame = typeof ((_a = WebSocket === null || WebSocket === void 0 ? void 0 : WebSocket.Sender) === null || _a === void 0 ? void 0 : _a.frame) === "function";
    var Adapter = class extends events_1.EventEmitter {
      /**
       * In-memory adapter constructor.
       *
       * @param nsp
       */
      constructor(nsp) {
        super();
        this.nsp = nsp;
        this.rooms = /* @__PURE__ */ new Map();
        this.sids = /* @__PURE__ */ new Map();
        this.encoder = nsp.server.encoder;
      }
      /**
       * To be overridden
       */
      init() {
      }
      /**
       * To be overridden
       */
      close() {
      }
      /**
       * Returns the number of Socket.IO servers in the cluster
       *
       * @public
       */
      serverCount() {
        return Promise.resolve(1);
      }
      /**
       * Adds a socket to a list of room.
       *
       * @param {SocketId}  id      the socket id
       * @param {Set<Room>} rooms   a set of rooms
       * @public
       */
      addAll(id, rooms) {
        if (!this.sids.has(id)) {
          this.sids.set(id, /* @__PURE__ */ new Set());
        }
        for (const room of rooms) {
          this.sids.get(id).add(room);
          if (!this.rooms.has(room)) {
            this.rooms.set(room, /* @__PURE__ */ new Set());
            this.emit("create-room", room);
          }
          if (!this.rooms.get(room).has(id)) {
            this.rooms.get(room).add(id);
            this.emit("join-room", room, id);
          }
        }
      }
      /**
       * Removes a socket from a room.
       *
       * @param {SocketId} id     the socket id
       * @param {Room}     room   the room name
       */
      del(id, room) {
        if (this.sids.has(id)) {
          this.sids.get(id).delete(room);
        }
        this._del(room, id);
      }
      _del(room, id) {
        const _room = this.rooms.get(room);
        if (_room != null) {
          const deleted = _room.delete(id);
          if (deleted) {
            this.emit("leave-room", room, id);
          }
          if (_room.size === 0 && this.rooms.delete(room)) {
            this.emit("delete-room", room);
          }
        }
      }
      /**
       * Removes a socket from all rooms it's joined.
       *
       * @param {SocketId} id   the socket id
       */
      delAll(id) {
        if (!this.sids.has(id)) {
          return;
        }
        for (const room of this.sids.get(id)) {
          this._del(room, id);
        }
        this.sids.delete(id);
      }
      /**
       * Broadcasts a packet.
       *
       * Options:
       *  - `flags` {Object} flags for this packet
       *  - `except` {Array} sids that should be excluded
       *  - `rooms` {Array} list of rooms to broadcast to
       *
       * @param {Object} packet   the packet object
       * @param {Object} opts     the options
       * @public
       */
      broadcast(packet, opts) {
        const flags = opts.flags || {};
        const packetOpts = {
          preEncoded: true,
          volatile: flags.volatile,
          compress: flags.compress
        };
        packet.nsp = this.nsp.name;
        const encodedPackets = this._encode(packet, packetOpts);
        this.apply(opts, (socket) => {
          if (typeof socket.notifyOutgoingListeners === "function") {
            socket.notifyOutgoingListeners(packet);
          }
          socket.client.writeToEngine(encodedPackets, packetOpts);
        });
      }
      /**
       * Broadcasts a packet and expects multiple acknowledgements.
       *
       * Options:
       *  - `flags` {Object} flags for this packet
       *  - `except` {Array} sids that should be excluded
       *  - `rooms` {Array} list of rooms to broadcast to
       *
       * @param {Object} packet   the packet object
       * @param {Object} opts     the options
       * @param clientCountCallback - the number of clients that received the packet
       * @param ack                 - the callback that will be called for each client response
       *
       * @public
       */
      broadcastWithAck(packet, opts, clientCountCallback, ack) {
        const flags = opts.flags || {};
        const packetOpts = {
          preEncoded: true,
          volatile: flags.volatile,
          compress: flags.compress
        };
        packet.nsp = this.nsp.name;
        packet.id = this.nsp._ids++;
        const encodedPackets = this._encode(packet, packetOpts);
        let clientCount = 0;
        this.apply(opts, (socket) => {
          clientCount++;
          socket.acks.set(packet.id, ack);
          if (typeof socket.notifyOutgoingListeners === "function") {
            socket.notifyOutgoingListeners(packet);
          }
          socket.client.writeToEngine(encodedPackets, packetOpts);
        });
        clientCountCallback(clientCount);
      }
      _encode(packet, packetOpts) {
        const encodedPackets = this.encoder.encode(packet);
        if (canPreComputeFrame && encodedPackets.length === 1 && typeof encodedPackets[0] === "string") {
          const data = Buffer.from("4" + encodedPackets[0]);
          packetOpts.wsPreEncodedFrame = WebSocket.Sender.frame(data, {
            readOnly: false,
            mask: false,
            rsv1: false,
            opcode: 1,
            fin: true
          });
        }
        return encodedPackets;
      }
      /**
       * Gets a list of sockets by sid.
       *
       * @param {Set<Room>} rooms   the explicit set of rooms to check.
       */
      sockets(rooms) {
        const sids = /* @__PURE__ */ new Set();
        this.apply({ rooms }, (socket) => {
          sids.add(socket.id);
        });
        return Promise.resolve(sids);
      }
      /**
       * Gets the list of rooms a given socket has joined.
       *
       * @param {SocketId} id   the socket id
       */
      socketRooms(id) {
        return this.sids.get(id);
      }
      /**
       * Returns the matching socket instances
       *
       * @param opts - the filters to apply
       */
      fetchSockets(opts) {
        const sockets = [];
        this.apply(opts, (socket) => {
          sockets.push(socket);
        });
        return Promise.resolve(sockets);
      }
      /**
       * Makes the matching socket instances join the specified rooms
       *
       * @param opts - the filters to apply
       * @param rooms - the rooms to join
       */
      addSockets(opts, rooms) {
        this.apply(opts, (socket) => {
          socket.join(rooms);
        });
      }
      /**
       * Makes the matching socket instances leave the specified rooms
       *
       * @param opts - the filters to apply
       * @param rooms - the rooms to leave
       */
      delSockets(opts, rooms) {
        this.apply(opts, (socket) => {
          rooms.forEach((room) => socket.leave(room));
        });
      }
      /**
       * Makes the matching socket instances disconnect
       *
       * @param opts - the filters to apply
       * @param close - whether to close the underlying connection
       */
      disconnectSockets(opts, close) {
        this.apply(opts, (socket) => {
          socket.disconnect(close);
        });
      }
      apply(opts, callback) {
        const rooms = opts.rooms;
        const except = this.computeExceptSids(opts.except);
        if (rooms.size) {
          const ids = /* @__PURE__ */ new Set();
          for (const room of rooms) {
            if (!this.rooms.has(room))
              continue;
            for (const id of this.rooms.get(room)) {
              if (ids.has(id) || except.has(id))
                continue;
              const socket = this.nsp.sockets.get(id);
              if (socket) {
                callback(socket);
                ids.add(id);
              }
            }
          }
        } else {
          for (const [id] of this.sids) {
            if (except.has(id))
              continue;
            const socket = this.nsp.sockets.get(id);
            if (socket)
              callback(socket);
          }
        }
      }
      computeExceptSids(exceptRooms) {
        const exceptSids = /* @__PURE__ */ new Set();
        if (exceptRooms && exceptRooms.size > 0) {
          for (const room of exceptRooms) {
            if (this.rooms.has(room)) {
              this.rooms.get(room).forEach((sid) => exceptSids.add(sid));
            }
          }
        }
        return exceptSids;
      }
      /**
       * Send a packet to the other Socket.IO servers in the cluster
       * @param packet - an array of arguments, which may include an acknowledgement callback at the end
       */
      serverSideEmit(packet) {
        console.warn("this adapter does not support the serverSideEmit() functionality");
      }
      /**
       * Save the client session in order to restore it upon reconnection.
       */
      persistSession(session) {
      }
      /**
       * Restore the session and find the packets that were missed by the client.
       * @param pid
       * @param offset
       */
      restoreSession(pid, offset) {
        return null;
      }
    };
    exports2.Adapter = Adapter;
    var SessionAwareAdapter = class extends Adapter {
      constructor(nsp) {
        super(nsp);
        this.nsp = nsp;
        this.sessions = /* @__PURE__ */ new Map();
        this.packets = [];
        this.maxDisconnectionDuration = nsp.server.opts.connectionStateRecovery.maxDisconnectionDuration;
        const timer = setInterval(() => {
          const threshold = Date.now() - this.maxDisconnectionDuration;
          this.sessions.forEach((session, sessionId) => {
            const hasExpired = session.disconnectedAt < threshold;
            if (hasExpired) {
              this.sessions.delete(sessionId);
            }
          });
          for (let i = this.packets.length - 1; i >= 0; i--) {
            const hasExpired = this.packets[i].emittedAt < threshold;
            if (hasExpired) {
              this.packets.splice(0, i + 1);
              break;
            }
          }
        }, 60 * 1e3);
        timer.unref();
      }
      persistSession(session) {
        session.disconnectedAt = Date.now();
        this.sessions.set(session.pid, session);
      }
      restoreSession(pid, offset) {
        const session = this.sessions.get(pid);
        if (!session) {
          return null;
        }
        const hasExpired = session.disconnectedAt + this.maxDisconnectionDuration < Date.now();
        if (hasExpired) {
          this.sessions.delete(pid);
          return null;
        }
        const index = this.packets.findIndex((packet) => packet.id === offset);
        if (index === -1) {
          return null;
        }
        const missedPackets = [];
        for (let i = index + 1; i < this.packets.length; i++) {
          const packet = this.packets[i];
          if (shouldIncludePacket(session.rooms, packet.opts)) {
            missedPackets.push(packet.data);
          }
        }
        return Promise.resolve(Object.assign(Object.assign({}, session), { missedPackets }));
      }
      broadcast(packet, opts) {
        var _a2;
        const isEventPacket = packet.type === 2;
        const withoutAcknowledgement = packet.id === void 0;
        const notVolatile = ((_a2 = opts.flags) === null || _a2 === void 0 ? void 0 : _a2.volatile) === void 0;
        if (isEventPacket && withoutAcknowledgement && notVolatile) {
          const id = (0, yeast_1.yeast)();
          packet.data.push(id);
          this.packets.push({
            id,
            opts,
            data: packet.data,
            emittedAt: Date.now()
          });
        }
        super.broadcast(packet, opts);
      }
    };
    exports2.SessionAwareAdapter = SessionAwareAdapter;
    function shouldIncludePacket(sessionRooms, opts) {
      const included = opts.rooms.size === 0 || sessionRooms.some((room) => opts.rooms.has(room));
      const notExcluded = sessionRooms.every((room) => !opts.except.has(room));
      return included && notExcluded;
    }
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self2 = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug") || exports2.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// node_modules/socket.io-adapter/dist/cluster-adapter.js
var require_cluster_adapter = __commonJS({
  "node_modules/socket.io-adapter/dist/cluster-adapter.js"(exports2) {
    "use strict";
    var __rest = exports2 && exports2.__rest || function(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
          if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
            t[p[i]] = s[p[i]];
        }
      return t;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ClusterAdapterWithHeartbeat = exports2.ClusterAdapter = exports2.MessageType = void 0;
    var in_memory_adapter_1 = require_in_memory_adapter();
    var debug_1 = require_src();
    var crypto_1 = require("crypto");
    var debug = (0, debug_1.debug)("socket.io-adapter");
    var EMITTER_UID = "emitter";
    var DEFAULT_TIMEOUT = 5e3;
    function randomId() {
      return (0, crypto_1.randomBytes)(8).toString("hex");
    }
    var MessageType;
    (function(MessageType2) {
      MessageType2[MessageType2["INITIAL_HEARTBEAT"] = 1] = "INITIAL_HEARTBEAT";
      MessageType2[MessageType2["HEARTBEAT"] = 2] = "HEARTBEAT";
      MessageType2[MessageType2["BROADCAST"] = 3] = "BROADCAST";
      MessageType2[MessageType2["SOCKETS_JOIN"] = 4] = "SOCKETS_JOIN";
      MessageType2[MessageType2["SOCKETS_LEAVE"] = 5] = "SOCKETS_LEAVE";
      MessageType2[MessageType2["DISCONNECT_SOCKETS"] = 6] = "DISCONNECT_SOCKETS";
      MessageType2[MessageType2["FETCH_SOCKETS"] = 7] = "FETCH_SOCKETS";
      MessageType2[MessageType2["FETCH_SOCKETS_RESPONSE"] = 8] = "FETCH_SOCKETS_RESPONSE";
      MessageType2[MessageType2["SERVER_SIDE_EMIT"] = 9] = "SERVER_SIDE_EMIT";
      MessageType2[MessageType2["SERVER_SIDE_EMIT_RESPONSE"] = 10] = "SERVER_SIDE_EMIT_RESPONSE";
      MessageType2[MessageType2["BROADCAST_CLIENT_COUNT"] = 11] = "BROADCAST_CLIENT_COUNT";
      MessageType2[MessageType2["BROADCAST_ACK"] = 12] = "BROADCAST_ACK";
      MessageType2[MessageType2["ADAPTER_CLOSE"] = 13] = "ADAPTER_CLOSE";
    })(MessageType || (exports2.MessageType = MessageType = {}));
    function encodeOptions(opts) {
      return {
        rooms: [...opts.rooms],
        except: [...opts.except],
        flags: opts.flags
      };
    }
    function decodeOptions(opts) {
      return {
        rooms: new Set(opts.rooms),
        except: new Set(opts.except),
        flags: opts.flags
      };
    }
    var ClusterAdapter = class extends in_memory_adapter_1.Adapter {
      constructor(nsp) {
        super(nsp);
        this.requests = /* @__PURE__ */ new Map();
        this.ackRequests = /* @__PURE__ */ new Map();
        this.uid = randomId();
      }
      /**
       * Called when receiving a message from another member of the cluster.
       *
       * @param message
       * @param offset
       * @protected
       */
      onMessage(message, offset) {
        if (message.uid === this.uid) {
          return debug("[%s] ignore message from self", this.uid);
        }
        if (message.nsp !== this.nsp.name) {
          return debug("[%s] ignore message from another namespace (%s)", this.uid, message.nsp);
        }
        debug("[%s] new event of type %d from %s", this.uid, message.type, message.uid);
        switch (message.type) {
          case MessageType.BROADCAST: {
            const withAck = message.data.requestId !== void 0;
            if (withAck) {
              super.broadcastWithAck(message.data.packet, decodeOptions(message.data.opts), (clientCount) => {
                debug("[%s] waiting for %d client acknowledgements", this.uid, clientCount);
                this.publishResponse(message.uid, {
                  type: MessageType.BROADCAST_CLIENT_COUNT,
                  data: {
                    requestId: message.data.requestId,
                    clientCount
                  }
                });
              }, (arg) => {
                debug("[%s] received acknowledgement with value %j", this.uid, arg);
                this.publishResponse(message.uid, {
                  type: MessageType.BROADCAST_ACK,
                  data: {
                    requestId: message.data.requestId,
                    packet: arg
                  }
                });
              });
            } else {
              const packet = message.data.packet;
              const opts = decodeOptions(message.data.opts);
              this.addOffsetIfNecessary(packet, opts, offset);
              super.broadcast(packet, opts);
            }
            break;
          }
          case MessageType.SOCKETS_JOIN:
            super.addSockets(decodeOptions(message.data.opts), message.data.rooms);
            break;
          case MessageType.SOCKETS_LEAVE:
            super.delSockets(decodeOptions(message.data.opts), message.data.rooms);
            break;
          case MessageType.DISCONNECT_SOCKETS:
            super.disconnectSockets(decodeOptions(message.data.opts), message.data.close);
            break;
          case MessageType.FETCH_SOCKETS: {
            debug("[%s] calling fetchSockets with opts %j", this.uid, message.data.opts);
            super.fetchSockets(decodeOptions(message.data.opts)).then((localSockets) => {
              this.publishResponse(message.uid, {
                type: MessageType.FETCH_SOCKETS_RESPONSE,
                data: {
                  requestId: message.data.requestId,
                  sockets: localSockets.map((socket) => {
                    const _a = socket.handshake, { sessionStore } = _a, handshake = __rest(_a, ["sessionStore"]);
                    return {
                      id: socket.id,
                      handshake,
                      rooms: [...socket.rooms],
                      data: socket.data
                    };
                  })
                }
              });
            });
            break;
          }
          case MessageType.SERVER_SIDE_EMIT: {
            const packet = message.data.packet;
            const withAck = message.data.requestId !== void 0;
            if (!withAck) {
              this.nsp._onServerSideEmit(packet);
              return;
            }
            let called = false;
            const callback = (arg) => {
              if (called) {
                return;
              }
              called = true;
              debug("[%s] calling acknowledgement with %j", this.uid, arg);
              this.publishResponse(message.uid, {
                type: MessageType.SERVER_SIDE_EMIT_RESPONSE,
                data: {
                  requestId: message.data.requestId,
                  packet: arg
                }
              });
            };
            this.nsp._onServerSideEmit([...packet, callback]);
            break;
          }
          // @ts-ignore
          case MessageType.BROADCAST_CLIENT_COUNT:
          // @ts-ignore
          case MessageType.BROADCAST_ACK:
          // @ts-ignore
          case MessageType.FETCH_SOCKETS_RESPONSE:
          // @ts-ignore
          case MessageType.SERVER_SIDE_EMIT_RESPONSE:
            this.onResponse(message);
            break;
          default:
            debug("[%s] unknown message type: %s", this.uid, message.type);
        }
      }
      /**
       * Called when receiving a response from another member of the cluster.
       *
       * @param response
       * @protected
       */
      onResponse(response) {
        var _a, _b;
        const requestId = response.data.requestId;
        debug("[%s] received response %s to request %s", this.uid, response.type, requestId);
        switch (response.type) {
          case MessageType.BROADCAST_CLIENT_COUNT: {
            (_a = this.ackRequests.get(requestId)) === null || _a === void 0 ? void 0 : _a.clientCountCallback(response.data.clientCount);
            break;
          }
          case MessageType.BROADCAST_ACK: {
            (_b = this.ackRequests.get(requestId)) === null || _b === void 0 ? void 0 : _b.ack(response.data.packet);
            break;
          }
          case MessageType.FETCH_SOCKETS_RESPONSE: {
            const request = this.requests.get(requestId);
            if (!request) {
              return;
            }
            request.current++;
            response.data.sockets.forEach((socket) => request.responses.push(socket));
            if (request.current === request.expected) {
              clearTimeout(request.timeout);
              request.resolve(request.responses);
              this.requests.delete(requestId);
            }
            break;
          }
          case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
            const request = this.requests.get(requestId);
            if (!request) {
              return;
            }
            request.current++;
            request.responses.push(response.data.packet);
            if (request.current === request.expected) {
              clearTimeout(request.timeout);
              request.resolve(null, request.responses);
              this.requests.delete(requestId);
            }
            break;
          }
          default:
            debug("[%s] unknown response type: %s", this.uid, response.type);
        }
      }
      async broadcast(packet, opts) {
        var _a;
        const onlyLocal = (_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          try {
            const offset = await this.publishAndReturnOffset({
              type: MessageType.BROADCAST,
              data: {
                packet,
                opts: encodeOptions(opts)
              }
            });
            this.addOffsetIfNecessary(packet, opts, offset);
          } catch (e) {
            return debug("[%s] error while broadcasting message: %s", this.uid, e.message);
          }
        }
        super.broadcast(packet, opts);
      }
      /**
       * Adds an offset at the end of the data array in order to allow the client to receive any missed packets when it
       * reconnects after a temporary disconnection.
       *
       * @param packet
       * @param opts
       * @param offset
       * @private
       */
      addOffsetIfNecessary(packet, opts, offset) {
        var _a;
        if (!this.nsp.server.opts.connectionStateRecovery) {
          return;
        }
        const isEventPacket = packet.type === 2;
        const withoutAcknowledgement = packet.id === void 0;
        const notVolatile = ((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.volatile) === void 0;
        if (isEventPacket && withoutAcknowledgement && notVolatile) {
          packet.data.push(offset);
        }
      }
      broadcastWithAck(packet, opts, clientCountCallback, ack) {
        var _a;
        const onlyLocal = (_a = opts === null || opts === void 0 ? void 0 : opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          const requestId = randomId();
          this.ackRequests.set(requestId, {
            clientCountCallback,
            ack
          });
          this.publish({
            type: MessageType.BROADCAST,
            data: {
              packet,
              requestId,
              opts: encodeOptions(opts)
            }
          });
          setTimeout(() => {
            this.ackRequests.delete(requestId);
          }, opts.flags.timeout);
        }
        super.broadcastWithAck(packet, opts, clientCountCallback, ack);
      }
      async addSockets(opts, rooms) {
        var _a;
        const onlyLocal = (_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          try {
            await this.publishAndReturnOffset({
              type: MessageType.SOCKETS_JOIN,
              data: {
                opts: encodeOptions(opts),
                rooms
              }
            });
          } catch (e) {
            debug("[%s] error while publishing message: %s", this.uid, e.message);
          }
        }
        super.addSockets(opts, rooms);
      }
      async delSockets(opts, rooms) {
        var _a;
        const onlyLocal = (_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          try {
            await this.publishAndReturnOffset({
              type: MessageType.SOCKETS_LEAVE,
              data: {
                opts: encodeOptions(opts),
                rooms
              }
            });
          } catch (e) {
            debug("[%s] error while publishing message: %s", this.uid, e.message);
          }
        }
        super.delSockets(opts, rooms);
      }
      async disconnectSockets(opts, close) {
        var _a;
        const onlyLocal = (_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          try {
            await this.publishAndReturnOffset({
              type: MessageType.DISCONNECT_SOCKETS,
              data: {
                opts: encodeOptions(opts),
                close
              }
            });
          } catch (e) {
            debug("[%s] error while publishing message: %s", this.uid, e.message);
          }
        }
        super.disconnectSockets(opts, close);
      }
      async fetchSockets(opts) {
        var _a;
        const [localSockets, serverCount] = await Promise.all([
          super.fetchSockets(opts),
          this.serverCount()
        ]);
        const expectedResponseCount = serverCount - 1;
        if (((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) || expectedResponseCount <= 0) {
          return localSockets;
        }
        const requestId = randomId();
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            const storedRequest2 = this.requests.get(requestId);
            if (storedRequest2) {
              reject(new Error(`timeout reached: only ${storedRequest2.current} responses received out of ${storedRequest2.expected}`));
              this.requests.delete(requestId);
            }
          }, opts.flags.timeout || DEFAULT_TIMEOUT);
          const storedRequest = {
            type: MessageType.FETCH_SOCKETS,
            resolve,
            timeout,
            current: 0,
            expected: expectedResponseCount,
            responses: localSockets
          };
          this.requests.set(requestId, storedRequest);
          this.publish({
            type: MessageType.FETCH_SOCKETS,
            data: {
              opts: encodeOptions(opts),
              requestId
            }
          });
        });
      }
      async serverSideEmit(packet) {
        const withAck = typeof packet[packet.length - 1] === "function";
        if (!withAck) {
          return this.publish({
            type: MessageType.SERVER_SIDE_EMIT,
            data: {
              packet
            }
          });
        }
        const ack = packet.pop();
        const expectedResponseCount = await this.serverCount() - 1;
        debug('[%s] waiting for %d responses to "serverSideEmit" request', this.uid, expectedResponseCount);
        if (expectedResponseCount <= 0) {
          return ack(null, []);
        }
        const requestId = randomId();
        const timeout = setTimeout(() => {
          const storedRequest2 = this.requests.get(requestId);
          if (storedRequest2) {
            ack(new Error(`timeout reached: only ${storedRequest2.current} responses received out of ${storedRequest2.expected}`), storedRequest2.responses);
            this.requests.delete(requestId);
          }
        }, DEFAULT_TIMEOUT);
        const storedRequest = {
          type: MessageType.SERVER_SIDE_EMIT,
          resolve: ack,
          timeout,
          current: 0,
          expected: expectedResponseCount,
          responses: []
        };
        this.requests.set(requestId, storedRequest);
        this.publish({
          type: MessageType.SERVER_SIDE_EMIT,
          data: {
            requestId,
            // the presence of this attribute defines whether an acknowledgement is needed
            packet
          }
        });
      }
      publish(message) {
        debug("[%s] sending message %s", this.uid, message.type);
        this.publishAndReturnOffset(message).catch((err) => {
          debug("[%s] error while publishing message: %s", this.uid, err);
        });
      }
      publishAndReturnOffset(message) {
        message.uid = this.uid;
        message.nsp = this.nsp.name;
        return this.doPublish(message);
      }
      publishResponse(requesterUid, response) {
        response.uid = this.uid;
        response.nsp = this.nsp.name;
        debug("[%s] sending response %s to %s", this.uid, response.type, requesterUid);
        this.doPublishResponse(requesterUid, response).catch((err) => {
          debug("[%s] error while publishing response: %s", this.uid, err);
        });
      }
    };
    exports2.ClusterAdapter = ClusterAdapter;
    var ClusterAdapterWithHeartbeat = class extends ClusterAdapter {
      constructor(nsp, opts) {
        super(nsp);
        this.nodesMap = /* @__PURE__ */ new Map();
        this.customRequests = /* @__PURE__ */ new Map();
        this._opts = Object.assign({
          heartbeatInterval: 5e3,
          heartbeatTimeout: 1e4
        }, opts);
        this.cleanupTimer = setInterval(() => {
          const now = Date.now();
          this.nodesMap.forEach((lastSeen, uid) => {
            const nodeSeemsDown = now - lastSeen > this._opts.heartbeatTimeout;
            if (nodeSeemsDown) {
              debug("[%s] node %s seems down", this.uid, uid);
              this.removeNode(uid);
            }
          });
        }, 1e3);
      }
      init() {
        this.publish({
          type: MessageType.INITIAL_HEARTBEAT
        });
      }
      scheduleHeartbeat() {
        if (this.heartbeatTimer) {
          this.heartbeatTimer.refresh();
        } else {
          this.heartbeatTimer = setTimeout(() => {
            this.publish({
              type: MessageType.HEARTBEAT
            });
          }, this._opts.heartbeatInterval);
        }
      }
      close() {
        this.publish({
          type: MessageType.ADAPTER_CLOSE
        });
        clearTimeout(this.heartbeatTimer);
        if (this.cleanupTimer) {
          clearInterval(this.cleanupTimer);
        }
      }
      onMessage(message, offset) {
        if (message.uid === this.uid) {
          return debug("[%s] ignore message from self", this.uid);
        }
        if (message.uid && message.uid !== EMITTER_UID) {
          this.nodesMap.set(message.uid, Date.now());
        }
        switch (message.type) {
          case MessageType.INITIAL_HEARTBEAT:
            this.publish({
              type: MessageType.HEARTBEAT
            });
            break;
          case MessageType.HEARTBEAT:
            break;
          case MessageType.ADAPTER_CLOSE:
            this.removeNode(message.uid);
            break;
          default:
            super.onMessage(message, offset);
        }
      }
      serverCount() {
        return Promise.resolve(1 + this.nodesMap.size);
      }
      publish(message) {
        this.scheduleHeartbeat();
        return super.publish(message);
      }
      async serverSideEmit(packet) {
        const withAck = typeof packet[packet.length - 1] === "function";
        if (!withAck) {
          return this.publish({
            type: MessageType.SERVER_SIDE_EMIT,
            data: {
              packet
            }
          });
        }
        const ack = packet.pop();
        const expectedResponseCount = this.nodesMap.size;
        debug('[%s] waiting for %d responses to "serverSideEmit" request', this.uid, expectedResponseCount);
        if (expectedResponseCount <= 0) {
          return ack(null, []);
        }
        const requestId = randomId();
        const timeout = setTimeout(() => {
          const storedRequest2 = this.customRequests.get(requestId);
          if (storedRequest2) {
            ack(new Error(`timeout reached: missing ${storedRequest2.missingUids.size} responses`), storedRequest2.responses);
            this.customRequests.delete(requestId);
          }
        }, DEFAULT_TIMEOUT);
        const storedRequest = {
          type: MessageType.SERVER_SIDE_EMIT,
          resolve: ack,
          timeout,
          missingUids: /* @__PURE__ */ new Set([...this.nodesMap.keys()]),
          responses: []
        };
        this.customRequests.set(requestId, storedRequest);
        this.publish({
          type: MessageType.SERVER_SIDE_EMIT,
          data: {
            requestId,
            // the presence of this attribute defines whether an acknowledgement is needed
            packet
          }
        });
      }
      async fetchSockets(opts) {
        var _a;
        const [localSockets, serverCount] = await Promise.all([
          super.fetchSockets({
            rooms: opts.rooms,
            except: opts.except,
            flags: {
              local: true
            }
          }),
          this.serverCount()
        ]);
        const expectedResponseCount = serverCount - 1;
        if (((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) || expectedResponseCount <= 0) {
          return localSockets;
        }
        const requestId = randomId();
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            const storedRequest2 = this.customRequests.get(requestId);
            if (storedRequest2) {
              reject(new Error(`timeout reached: missing ${storedRequest2.missingUids.size} responses`));
              this.customRequests.delete(requestId);
            }
          }, opts.flags.timeout || DEFAULT_TIMEOUT);
          const storedRequest = {
            type: MessageType.FETCH_SOCKETS,
            resolve,
            timeout,
            missingUids: /* @__PURE__ */ new Set([...this.nodesMap.keys()]),
            responses: localSockets
          };
          this.customRequests.set(requestId, storedRequest);
          this.publish({
            type: MessageType.FETCH_SOCKETS,
            data: {
              opts: encodeOptions(opts),
              requestId
            }
          });
        });
      }
      onResponse(response) {
        const requestId = response.data.requestId;
        debug("[%s] received response %s to request %s", this.uid, response.type, requestId);
        switch (response.type) {
          case MessageType.FETCH_SOCKETS_RESPONSE: {
            const request = this.customRequests.get(requestId);
            if (!request) {
              return;
            }
            response.data.sockets.forEach((socket) => request.responses.push(socket));
            request.missingUids.delete(response.uid);
            if (request.missingUids.size === 0) {
              clearTimeout(request.timeout);
              request.resolve(request.responses);
              this.customRequests.delete(requestId);
            }
            break;
          }
          case MessageType.SERVER_SIDE_EMIT_RESPONSE: {
            const request = this.customRequests.get(requestId);
            if (!request) {
              return;
            }
            request.responses.push(response.data.packet);
            request.missingUids.delete(response.uid);
            if (request.missingUids.size === 0) {
              clearTimeout(request.timeout);
              request.resolve(null, request.responses);
              this.customRequests.delete(requestId);
            }
            break;
          }
          default:
            super.onResponse(response);
        }
      }
      removeNode(uid) {
        this.customRequests.forEach((request, requestId) => {
          request.missingUids.delete(uid);
          if (request.missingUids.size === 0) {
            clearTimeout(request.timeout);
            if (request.type === MessageType.FETCH_SOCKETS) {
              request.resolve(request.responses);
            } else if (request.type === MessageType.SERVER_SIDE_EMIT) {
              request.resolve(null, request.responses);
            }
            this.customRequests.delete(requestId);
          }
        });
        this.nodesMap.delete(uid);
      }
    };
    exports2.ClusterAdapterWithHeartbeat = ClusterAdapterWithHeartbeat;
  }
});

// node_modules/socket.io-adapter/dist/index.js
var require_dist = __commonJS({
  "node_modules/socket.io-adapter/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MessageType = exports2.ClusterAdapterWithHeartbeat = exports2.ClusterAdapter = exports2.SessionAwareAdapter = exports2.Adapter = void 0;
    var in_memory_adapter_1 = require_in_memory_adapter();
    Object.defineProperty(exports2, "Adapter", { enumerable: true, get: function() {
      return in_memory_adapter_1.Adapter;
    } });
    Object.defineProperty(exports2, "SessionAwareAdapter", { enumerable: true, get: function() {
      return in_memory_adapter_1.SessionAwareAdapter;
    } });
    var cluster_adapter_1 = require_cluster_adapter();
    Object.defineProperty(exports2, "ClusterAdapter", { enumerable: true, get: function() {
      return cluster_adapter_1.ClusterAdapter;
    } });
    Object.defineProperty(exports2, "ClusterAdapterWithHeartbeat", { enumerable: true, get: function() {
      return cluster_adapter_1.ClusterAdapterWithHeartbeat;
    } });
    Object.defineProperty(exports2, "MessageType", { enumerable: true, get: function() {
      return cluster_adapter_1.MessageType;
    } });
  }
});

// node_modules/@socket.io/redis-adapter/dist/util.js
var require_util = __commonJS({
  "node_modules/@socket.io/redis-adapter/dist/util.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PUBSUB = exports2.SPUBLISH = exports2.SUNSUBSCRIBE = exports2.SSUBSCRIBE = exports2.sumValues = exports2.parseNumSubResponse = exports2.hasBinary = void 0;
    function hasBinary(obj, toJSON2) {
      if (!obj || typeof obj !== "object") {
        return false;
      }
      if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
        return true;
      }
      if (Array.isArray(obj)) {
        for (let i = 0, l = obj.length; i < l; i++) {
          if (hasBinary(obj[i])) {
            return true;
          }
        }
        return false;
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
          return true;
        }
      }
      if (obj.toJSON && typeof obj.toJSON === "function" && !toJSON2) {
        return hasBinary(obj.toJSON(), true);
      }
      return false;
    }
    exports2.hasBinary = hasBinary;
    function parseNumSubResponse(res) {
      return parseInt(res[1], 10);
    }
    exports2.parseNumSubResponse = parseNumSubResponse;
    function sumValues(values) {
      return values.reduce((acc, val) => {
        return acc + val;
      }, 0);
    }
    exports2.sumValues = sumValues;
    var RETURN_BUFFERS = true;
    function isRedisV4Client(redisClient) {
      return typeof redisClient.sSubscribe === "function";
    }
    var kHandlers = /* @__PURE__ */ Symbol("handlers");
    function SSUBSCRIBE(redisClient, channel, handler) {
      if (isRedisV4Client(redisClient)) {
        redisClient.sSubscribe(channel, handler, RETURN_BUFFERS);
      } else {
        if (!redisClient[kHandlers]) {
          redisClient[kHandlers] = /* @__PURE__ */ new Map();
          redisClient.on("smessageBuffer", (rawChannel, message) => {
            var _a;
            (_a = redisClient[kHandlers].get(rawChannel.toString())) === null || _a === void 0 ? void 0 : _a(message, rawChannel);
          });
        }
        redisClient[kHandlers].set(channel, handler);
        redisClient.ssubscribe(channel);
      }
    }
    exports2.SSUBSCRIBE = SSUBSCRIBE;
    function SUNSUBSCRIBE(redisClient, channel) {
      if (isRedisV4Client(redisClient)) {
        redisClient.sUnsubscribe(channel);
      } else {
        redisClient.sunsubscribe(channel);
        if (Array.isArray(channel)) {
          channel.forEach((c) => redisClient[kHandlers].delete(c));
        } else {
          redisClient[kHandlers].delete(channel);
        }
      }
    }
    exports2.SUNSUBSCRIBE = SUNSUBSCRIBE;
    function SPUBLISH(redisClient, channel, payload) {
      if (isRedisV4Client(redisClient)) {
        return redisClient.sPublish(channel, payload);
      } else {
        return redisClient.spublish(channel, payload);
      }
    }
    exports2.SPUBLISH = SPUBLISH;
    function PUBSUB(redisClient, arg, channel) {
      if (redisClient.constructor.name === "Cluster" || redisClient.isCluster) {
        return Promise.all(redisClient.nodes().map((node) => {
          return node.send_command("PUBSUB", [arg, channel]).then(parseNumSubResponse);
        })).then(sumValues);
      } else if (isRedisV4Client(redisClient)) {
        const isCluster = Array.isArray(redisClient.masters);
        if (isCluster) {
          const nodes = redisClient.masters;
          return Promise.all(nodes.map((node) => {
            return node.client.sendCommand(["PUBSUB", arg, channel]).then(parseNumSubResponse);
          })).then(sumValues);
        } else {
          return redisClient.sendCommand(["PUBSUB", arg, channel]).then(parseNumSubResponse);
        }
      } else {
        return new Promise((resolve, reject) => {
          redisClient.send_command("PUBSUB", [arg, channel], (err, numSub) => {
            if (err)
              return reject(err);
            resolve(parseNumSubResponse(numSub));
          });
        });
      }
    }
    exports2.PUBSUB = PUBSUB;
  }
});

// node_modules/@socket.io/redis-adapter/node_modules/debug/src/common.js
var require_common2 = __commonJS({
  "node_modules/@socket.io/redis-adapter/node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self2 = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        let i;
        const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
        const len = split.length;
        for (i = 0; i < len; i++) {
          if (!split[i]) {
            continue;
          }
          namespaces = split[i].replace(/\*/g, ".*?");
          if (namespaces[0] === "-") {
            createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
          } else {
            createDebug.names.push(new RegExp("^" + namespaces + "$"));
          }
        }
      }
      function disable() {
        const namespaces = [
          ...createDebug.names.map(toNamespace),
          ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        if (name[name.length - 1] === "*") {
          return true;
        }
        let i;
        let len;
        for (i = 0, len = createDebug.skips.length; i < len; i++) {
          if (createDebug.skips[i].test(name)) {
            return false;
          }
        }
        for (i = 0, len = createDebug.names.length; i < len; i++) {
          if (createDebug.names[i].test(name)) {
            return true;
          }
        }
        return false;
      }
      function toNamespace(regexp) {
        return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// node_modules/@socket.io/redis-adapter/node_modules/debug/src/browser.js
var require_browser2 = __commonJS({
  "node_modules/@socket.io/redis-adapter/node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common2()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/@socket.io/redis-adapter/node_modules/debug/src/node.js
var require_node2 = __commonJS({
  "node_modules/@socket.io/redis-adapter/node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common2()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/@socket.io/redis-adapter/node_modules/debug/src/index.js
var require_src2 = __commonJS({
  "node_modules/@socket.io/redis-adapter/node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser2();
    } else {
      module2.exports = require_node2();
    }
  }
});

// node_modules/@socket.io/redis-adapter/dist/sharded-adapter.js
var require_sharded_adapter = __commonJS({
  "node_modules/@socket.io/redis-adapter/dist/sharded-adapter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createShardedAdapter = void 0;
    var socket_io_adapter_1 = require_dist();
    var notepack_io_1 = require_lib();
    var util_1 = require_util();
    var debug_1 = require_src2();
    var debug = (0, debug_1.default)("socket.io-redis");
    function looksLikeASocketId(room) {
      return typeof room === "string" && room.length === 20;
    }
    function createShardedAdapter(pubClient2, subClient2, opts) {
      return function(nsp) {
        return new ShardedRedisAdapter(nsp, pubClient2, subClient2, opts);
      };
    }
    exports2.createShardedAdapter = createShardedAdapter;
    var ShardedRedisAdapter = class extends socket_io_adapter_1.ClusterAdapter {
      constructor(nsp, pubClient2, subClient2, opts) {
        super(nsp);
        this.pubClient = pubClient2;
        this.subClient = subClient2;
        this.opts = Object.assign({
          channelPrefix: "socket.io",
          subscriptionMode: "dynamic"
        }, opts);
        this.channel = `${this.opts.channelPrefix}#${nsp.name}#`;
        this.responseChannel = `${this.opts.channelPrefix}#${nsp.name}#${this.uid}#`;
        const handler = (message, channel) => this.onRawMessage(message, channel);
        (0, util_1.SSUBSCRIBE)(this.subClient, this.channel, handler);
        (0, util_1.SSUBSCRIBE)(this.subClient, this.responseChannel, handler);
        if (this.opts.subscriptionMode === "dynamic" || this.opts.subscriptionMode === "dynamic-private") {
          this.on("create-room", (room) => {
            if (this.shouldUseASeparateNamespace(room)) {
              (0, util_1.SSUBSCRIBE)(this.subClient, this.dynamicChannel(room), handler);
            }
          });
          this.on("delete-room", (room) => {
            if (this.shouldUseASeparateNamespace(room)) {
              (0, util_1.SUNSUBSCRIBE)(this.subClient, this.dynamicChannel(room));
            }
          });
        }
      }
      close() {
        const channels = [this.channel, this.responseChannel];
        if (this.opts.subscriptionMode === "dynamic" || this.opts.subscriptionMode === "dynamic-private") {
          this.rooms.forEach((_sids, room) => {
            if (this.shouldUseASeparateNamespace(room)) {
              channels.push(this.dynamicChannel(room));
            }
          });
        }
        return Promise.all(channels.map((channel) => (0, util_1.SUNSUBSCRIBE)(this.subClient, channel))).then();
      }
      doPublish(message) {
        const channel = this.computeChannel(message);
        debug("publishing message of type %s to %s", message.type, channel);
        return (0, util_1.SPUBLISH)(this.pubClient, channel, this.encode(message)).then(() => "");
      }
      computeChannel(message) {
        const useDynamicChannel = message.type === socket_io_adapter_1.MessageType.BROADCAST && message.data.requestId === void 0 && message.data.opts.rooms.length === 1 && (this.opts.subscriptionMode === "dynamic" && !looksLikeASocketId(message.data.opts.rooms[0]) || this.opts.subscriptionMode === "dynamic-private");
        if (useDynamicChannel) {
          return this.dynamicChannel(message.data.opts.rooms[0]);
        } else {
          return this.channel;
        }
      }
      dynamicChannel(room) {
        return this.channel + room + "#";
      }
      doPublishResponse(requesterUid, response) {
        debug("publishing response of type %s to %s", response.type, requesterUid);
        return (0, util_1.SPUBLISH)(this.pubClient, `${this.channel}${requesterUid}#`, this.encode(response)).then();
      }
      encode(message) {
        const mayContainBinary = [
          socket_io_adapter_1.MessageType.BROADCAST,
          socket_io_adapter_1.MessageType.BROADCAST_ACK,
          socket_io_adapter_1.MessageType.FETCH_SOCKETS_RESPONSE,
          socket_io_adapter_1.MessageType.SERVER_SIDE_EMIT,
          socket_io_adapter_1.MessageType.SERVER_SIDE_EMIT_RESPONSE
        ].includes(message.type);
        if (mayContainBinary && (0, util_1.hasBinary)(message.data)) {
          return (0, notepack_io_1.encode)(message);
        } else {
          return JSON.stringify(message);
        }
      }
      onRawMessage(rawMessage, channel) {
        let message;
        try {
          if (rawMessage[0] === 123) {
            message = JSON.parse(rawMessage.toString());
          } else {
            message = (0, notepack_io_1.decode)(rawMessage);
          }
        } catch (e) {
          return debug("invalid format: %s", e.message);
        }
        if (channel.toString() === this.responseChannel) {
          this.onResponse(message);
        } else {
          this.onMessage(message);
        }
      }
      serverCount() {
        return (0, util_1.PUBSUB)(this.pubClient, "SHARDNUMSUB", this.channel);
      }
      shouldUseASeparateNamespace(room) {
        const isPublicRoom = !this.sids.has(room);
        return this.opts.subscriptionMode === "dynamic" && isPublicRoom || this.opts.subscriptionMode === "dynamic-private";
      }
    };
  }
});

// node_modules/@socket.io/redis-adapter/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/@socket.io/redis-adapter/dist/index.js"(exports2, module2) {
    "use strict";
    var __rest = exports2 && exports2.__rest || function(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
          if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
            t[p[i]] = s[p[i]];
        }
      return t;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createShardedAdapter = exports2.RedisAdapter = exports2.createAdapter = void 0;
    var uid2 = require_uid2();
    var msgpack = require_lib();
    var socket_io_adapter_1 = require_dist();
    var util_1 = require_util();
    var debug = require_src2()("socket.io-redis");
    module2.exports = exports2 = createAdapter2;
    var RequestType;
    (function(RequestType2) {
      RequestType2[RequestType2["SOCKETS"] = 0] = "SOCKETS";
      RequestType2[RequestType2["ALL_ROOMS"] = 1] = "ALL_ROOMS";
      RequestType2[RequestType2["REMOTE_JOIN"] = 2] = "REMOTE_JOIN";
      RequestType2[RequestType2["REMOTE_LEAVE"] = 3] = "REMOTE_LEAVE";
      RequestType2[RequestType2["REMOTE_DISCONNECT"] = 4] = "REMOTE_DISCONNECT";
      RequestType2[RequestType2["REMOTE_FETCH"] = 5] = "REMOTE_FETCH";
      RequestType2[RequestType2["SERVER_SIDE_EMIT"] = 6] = "SERVER_SIDE_EMIT";
      RequestType2[RequestType2["BROADCAST"] = 7] = "BROADCAST";
      RequestType2[RequestType2["BROADCAST_CLIENT_COUNT"] = 8] = "BROADCAST_CLIENT_COUNT";
      RequestType2[RequestType2["BROADCAST_ACK"] = 9] = "BROADCAST_ACK";
    })(RequestType || (RequestType = {}));
    var isNumeric = (str) => !isNaN(str) && !isNaN(parseFloat(str));
    function createAdapter2(pubClient2, subClient2, opts) {
      return function(nsp) {
        return new RedisAdapter(nsp, pubClient2, subClient2, opts);
      };
    }
    exports2.createAdapter = createAdapter2;
    var RedisAdapter = class extends socket_io_adapter_1.Adapter {
      /**
       * Adapter constructor.
       *
       * @param nsp - the namespace
       * @param pubClient - a Redis client that will be used to publish messages
       * @param subClient - a Redis client that will be used to receive messages (put in subscribed state)
       * @param opts - additional options
       *
       * @public
       */
      constructor(nsp, pubClient2, subClient2, opts = {}) {
        super(nsp);
        this.pubClient = pubClient2;
        this.subClient = subClient2;
        this.requests = /* @__PURE__ */ new Map();
        this.ackRequests = /* @__PURE__ */ new Map();
        this.redisListeners = /* @__PURE__ */ new Map();
        this.uid = uid2(6);
        this.requestsTimeout = opts.requestsTimeout || 5e3;
        this.publishOnSpecificResponseChannel = !!opts.publishOnSpecificResponseChannel;
        this.parser = opts.parser || msgpack;
        const prefix = opts.key || "socket.io";
        this.channel = prefix + "#" + nsp.name + "#";
        this.requestChannel = prefix + "-request#" + this.nsp.name + "#";
        this.responseChannel = prefix + "-response#" + this.nsp.name + "#";
        this.specificResponseChannel = this.responseChannel + this.uid + "#";
        const isRedisV4 = typeof this.pubClient.pSubscribe === "function";
        if (isRedisV4) {
          this.redisListeners.set("psub", (msg, channel) => {
            this.onmessage(null, channel, msg);
          });
          this.redisListeners.set("sub", (msg, channel) => {
            this.onrequest(channel, msg);
          });
          this.subClient.pSubscribe(this.channel + "*", this.redisListeners.get("psub"), true);
          this.subClient.subscribe([
            this.requestChannel,
            this.responseChannel,
            this.specificResponseChannel
          ], this.redisListeners.get("sub"), true);
        } else {
          this.redisListeners.set("pmessageBuffer", this.onmessage.bind(this));
          this.redisListeners.set("messageBuffer", this.onrequest.bind(this));
          this.subClient.psubscribe(this.channel + "*");
          this.subClient.on("pmessageBuffer", this.redisListeners.get("pmessageBuffer"));
          this.subClient.subscribe([
            this.requestChannel,
            this.responseChannel,
            this.specificResponseChannel
          ]);
          this.subClient.on("messageBuffer", this.redisListeners.get("messageBuffer"));
        }
        this.friendlyErrorHandler = function() {
          if (this.listenerCount("error") === 1) {
            console.warn("missing 'error' handler on this Redis client");
          }
        };
        this.pubClient.on("error", this.friendlyErrorHandler);
        this.subClient.on("error", this.friendlyErrorHandler);
      }
      /**
       * Called with a subscription message
       *
       * @private
       */
      onmessage(pattern, channel, msg) {
        channel = channel.toString();
        const channelMatches = channel.startsWith(this.channel);
        if (!channelMatches) {
          return debug("ignore different channel");
        }
        const room = channel.slice(this.channel.length, -1);
        if (room !== "" && !this.hasRoom(room)) {
          return debug("ignore unknown room %s", room);
        }
        const args = this.parser.decode(msg);
        const [uid, packet, opts] = args;
        if (this.uid === uid)
          return debug("ignore same uid");
        if (packet && packet.nsp === void 0) {
          packet.nsp = "/";
        }
        if (!packet || packet.nsp !== this.nsp.name) {
          return debug("ignore different namespace");
        }
        opts.rooms = new Set(opts.rooms);
        opts.except = new Set(opts.except);
        super.broadcast(packet, opts);
      }
      hasRoom(room) {
        const hasNumericRoom = isNumeric(room) && this.rooms.has(parseFloat(room));
        return hasNumericRoom || this.rooms.has(room);
      }
      /**
       * Called on request from another node
       *
       * @private
       */
      async onrequest(channel, msg) {
        channel = channel.toString();
        if (channel.startsWith(this.responseChannel)) {
          return this.onresponse(channel, msg);
        } else if (!channel.startsWith(this.requestChannel)) {
          return debug("ignore different channel");
        }
        let request;
        try {
          if (msg[0] === 123) {
            request = JSON.parse(msg.toString());
          } else {
            request = this.parser.decode(msg);
          }
        } catch (err) {
          debug("ignoring malformed request");
          return;
        }
        debug("received request %j", request);
        let response, socket;
        switch (request.type) {
          case RequestType.SOCKETS:
            if (this.requests.has(request.requestId)) {
              return;
            }
            const sockets = await super.sockets(new Set(request.rooms));
            response = JSON.stringify({
              requestId: request.requestId,
              sockets: [...sockets]
            });
            this.publishResponse(request, response);
            break;
          case RequestType.ALL_ROOMS:
            if (this.requests.has(request.requestId)) {
              return;
            }
            response = JSON.stringify({
              requestId: request.requestId,
              rooms: [...this.rooms.keys()]
            });
            this.publishResponse(request, response);
            break;
          case RequestType.REMOTE_JOIN:
            if (request.opts) {
              const opts2 = {
                rooms: new Set(request.opts.rooms),
                except: new Set(request.opts.except)
              };
              return super.addSockets(opts2, request.rooms);
            }
            socket = this.nsp.sockets.get(request.sid);
            if (!socket) {
              return;
            }
            socket.join(request.room);
            response = JSON.stringify({
              requestId: request.requestId
            });
            this.publishResponse(request, response);
            break;
          case RequestType.REMOTE_LEAVE:
            if (request.opts) {
              const opts2 = {
                rooms: new Set(request.opts.rooms),
                except: new Set(request.opts.except)
              };
              return super.delSockets(opts2, request.rooms);
            }
            socket = this.nsp.sockets.get(request.sid);
            if (!socket) {
              return;
            }
            socket.leave(request.room);
            response = JSON.stringify({
              requestId: request.requestId
            });
            this.publishResponse(request, response);
            break;
          case RequestType.REMOTE_DISCONNECT:
            if (request.opts) {
              const opts2 = {
                rooms: new Set(request.opts.rooms),
                except: new Set(request.opts.except)
              };
              return super.disconnectSockets(opts2, request.close);
            }
            socket = this.nsp.sockets.get(request.sid);
            if (!socket) {
              return;
            }
            socket.disconnect(request.close);
            response = JSON.stringify({
              requestId: request.requestId
            });
            this.publishResponse(request, response);
            break;
          case RequestType.REMOTE_FETCH:
            if (this.requests.has(request.requestId)) {
              return;
            }
            const opts = {
              rooms: new Set(request.opts.rooms),
              except: new Set(request.opts.except)
            };
            const localSockets = await super.fetchSockets(opts);
            response = JSON.stringify({
              requestId: request.requestId,
              sockets: localSockets.map((socket2) => {
                const _a = socket2.handshake, { sessionStore } = _a, handshake = __rest(_a, ["sessionStore"]);
                return {
                  id: socket2.id,
                  handshake,
                  rooms: [...socket2.rooms],
                  data: socket2.data
                };
              })
            });
            this.publishResponse(request, response);
            break;
          case RequestType.SERVER_SIDE_EMIT:
            if (request.uid === this.uid) {
              debug("ignore same uid");
              return;
            }
            const withAck = request.requestId !== void 0;
            if (!withAck) {
              this.nsp._onServerSideEmit(request.data);
              return;
            }
            let called = false;
            const callback = (arg) => {
              if (called) {
                return;
              }
              called = true;
              debug("calling acknowledgement with %j", arg);
              this.pubClient.publish(this.responseChannel, JSON.stringify({
                type: RequestType.SERVER_SIDE_EMIT,
                requestId: request.requestId,
                data: arg
              }));
            };
            request.data.push(callback);
            this.nsp._onServerSideEmit(request.data);
            break;
          case RequestType.BROADCAST: {
            if (this.ackRequests.has(request.requestId)) {
              return;
            }
            const opts2 = {
              rooms: new Set(request.opts.rooms),
              except: new Set(request.opts.except)
            };
            super.broadcastWithAck(request.packet, opts2, (clientCount) => {
              debug("waiting for %d client acknowledgements", clientCount);
              this.publishResponse(request, JSON.stringify({
                type: RequestType.BROADCAST_CLIENT_COUNT,
                requestId: request.requestId,
                clientCount
              }));
            }, (arg) => {
              debug("received acknowledgement with value %j", arg);
              this.publishResponse(request, this.parser.encode({
                type: RequestType.BROADCAST_ACK,
                requestId: request.requestId,
                packet: arg
              }));
            });
            break;
          }
          default:
            debug("ignoring unknown request type: %s", request.type);
        }
      }
      /**
       * Send the response to the requesting node
       * @param request
       * @param response
       * @private
       */
      publishResponse(request, response) {
        const responseChannel = this.publishOnSpecificResponseChannel ? `${this.responseChannel}${request.uid}#` : this.responseChannel;
        debug("publishing response to channel %s", responseChannel);
        this.pubClient.publish(responseChannel, response);
      }
      /**
       * Called on response from another node
       *
       * @private
       */
      onresponse(channel, msg) {
        let response;
        try {
          if (msg[0] === 123) {
            response = JSON.parse(msg.toString());
          } else {
            response = this.parser.decode(msg);
          }
        } catch (err) {
          debug("ignoring malformed response");
          return;
        }
        const requestId = response.requestId;
        if (this.ackRequests.has(requestId)) {
          const ackRequest = this.ackRequests.get(requestId);
          switch (response.type) {
            case RequestType.BROADCAST_CLIENT_COUNT: {
              ackRequest === null || ackRequest === void 0 ? void 0 : ackRequest.clientCountCallback(response.clientCount);
              break;
            }
            case RequestType.BROADCAST_ACK: {
              ackRequest === null || ackRequest === void 0 ? void 0 : ackRequest.ack(response.packet);
              break;
            }
          }
          return;
        }
        if (!requestId || !(this.requests.has(requestId) || this.ackRequests.has(requestId))) {
          debug("ignoring unknown request");
          return;
        }
        debug("received response %j", response);
        const request = this.requests.get(requestId);
        switch (request.type) {
          case RequestType.SOCKETS:
          case RequestType.REMOTE_FETCH:
            request.msgCount++;
            if (!response.sockets || !Array.isArray(response.sockets))
              return;
            if (request.type === RequestType.SOCKETS) {
              response.sockets.forEach((s) => request.sockets.add(s));
            } else {
              response.sockets.forEach((s) => request.sockets.push(s));
            }
            if (request.msgCount === request.numSub) {
              clearTimeout(request.timeout);
              if (request.resolve) {
                request.resolve(request.sockets);
              }
              this.requests.delete(requestId);
            }
            break;
          case RequestType.ALL_ROOMS:
            request.msgCount++;
            if (!response.rooms || !Array.isArray(response.rooms))
              return;
            response.rooms.forEach((s) => request.rooms.add(s));
            if (request.msgCount === request.numSub) {
              clearTimeout(request.timeout);
              if (request.resolve) {
                request.resolve(request.rooms);
              }
              this.requests.delete(requestId);
            }
            break;
          case RequestType.REMOTE_JOIN:
          case RequestType.REMOTE_LEAVE:
          case RequestType.REMOTE_DISCONNECT:
            clearTimeout(request.timeout);
            if (request.resolve) {
              request.resolve();
            }
            this.requests.delete(requestId);
            break;
          case RequestType.SERVER_SIDE_EMIT:
            request.responses.push(response.data);
            debug("serverSideEmit: got %d responses out of %d", request.responses.length, request.numSub);
            if (request.responses.length === request.numSub) {
              clearTimeout(request.timeout);
              if (request.resolve) {
                request.resolve(null, request.responses);
              }
              this.requests.delete(requestId);
            }
            break;
          default:
            debug("ignoring unknown request type: %s", request.type);
        }
      }
      /**
       * Broadcasts a packet.
       *
       * @param {Object} packet - packet to emit
       * @param {Object} opts - options
       *
       * @public
       */
      broadcast(packet, opts) {
        packet.nsp = this.nsp.name;
        const onlyLocal = opts && opts.flags && opts.flags.local;
        if (!onlyLocal) {
          const rawOpts = {
            rooms: [...opts.rooms],
            except: [...new Set(opts.except)],
            flags: opts.flags
          };
          const msg = this.parser.encode([this.uid, packet, rawOpts]);
          let channel = this.channel;
          if (opts.rooms && opts.rooms.size === 1) {
            channel += opts.rooms.keys().next().value + "#";
          }
          debug("publishing message to channel %s", channel);
          this.pubClient.publish(channel, msg);
        }
        super.broadcast(packet, opts);
      }
      broadcastWithAck(packet, opts, clientCountCallback, ack) {
        var _a;
        packet.nsp = this.nsp.name;
        const onlyLocal = (_a = opts === null || opts === void 0 ? void 0 : opts.flags) === null || _a === void 0 ? void 0 : _a.local;
        if (!onlyLocal) {
          const requestId = uid2(6);
          const rawOpts = {
            rooms: [...opts.rooms],
            except: [...new Set(opts.except)],
            flags: opts.flags
          };
          const request = this.parser.encode({
            uid: this.uid,
            requestId,
            type: RequestType.BROADCAST,
            packet,
            opts: rawOpts
          });
          this.pubClient.publish(this.requestChannel, request);
          this.ackRequests.set(requestId, {
            clientCountCallback,
            ack
          });
          setTimeout(() => {
            this.ackRequests.delete(requestId);
          }, opts.flags.timeout);
        }
        super.broadcastWithAck(packet, opts, clientCountCallback, ack);
      }
      /**
       * Gets the list of all rooms (across every node)
       *
       * @public
       */
      async allRooms() {
        const localRooms = new Set(this.rooms.keys());
        const numSub = await this.serverCount();
        debug('waiting for %d responses to "allRooms" request', numSub);
        if (numSub <= 1) {
          return localRooms;
        }
        const requestId = uid2(6);
        const request = JSON.stringify({
          uid: this.uid,
          requestId,
          type: RequestType.ALL_ROOMS
        });
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (this.requests.has(requestId)) {
              reject(new Error("timeout reached while waiting for allRooms response"));
              this.requests.delete(requestId);
            }
          }, this.requestsTimeout);
          this.requests.set(requestId, {
            type: RequestType.ALL_ROOMS,
            numSub,
            resolve,
            timeout,
            msgCount: 1,
            rooms: localRooms
          });
          this.pubClient.publish(this.requestChannel, request);
        });
      }
      async fetchSockets(opts) {
        var _a;
        const localSockets = await super.fetchSockets(opts);
        if ((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) {
          return localSockets;
        }
        const numSub = await this.serverCount();
        debug('waiting for %d responses to "fetchSockets" request', numSub);
        if (numSub <= 1) {
          return localSockets;
        }
        const requestId = uid2(6);
        const request = JSON.stringify({
          uid: this.uid,
          requestId,
          type: RequestType.REMOTE_FETCH,
          opts: {
            rooms: [...opts.rooms],
            except: [...opts.except]
          }
        });
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (this.requests.has(requestId)) {
              reject(new Error("timeout reached while waiting for fetchSockets response"));
              this.requests.delete(requestId);
            }
          }, this.requestsTimeout);
          this.requests.set(requestId, {
            type: RequestType.REMOTE_FETCH,
            numSub,
            resolve,
            timeout,
            msgCount: 1,
            sockets: localSockets
          });
          this.pubClient.publish(this.requestChannel, request);
        });
      }
      addSockets(opts, rooms) {
        var _a;
        if ((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) {
          return super.addSockets(opts, rooms);
        }
        const request = JSON.stringify({
          uid: this.uid,
          type: RequestType.REMOTE_JOIN,
          opts: {
            rooms: [...opts.rooms],
            except: [...opts.except]
          },
          rooms: [...rooms]
        });
        this.pubClient.publish(this.requestChannel, request);
      }
      delSockets(opts, rooms) {
        var _a;
        if ((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) {
          return super.delSockets(opts, rooms);
        }
        const request = JSON.stringify({
          uid: this.uid,
          type: RequestType.REMOTE_LEAVE,
          opts: {
            rooms: [...opts.rooms],
            except: [...opts.except]
          },
          rooms: [...rooms]
        });
        this.pubClient.publish(this.requestChannel, request);
      }
      disconnectSockets(opts, close) {
        var _a;
        if ((_a = opts.flags) === null || _a === void 0 ? void 0 : _a.local) {
          return super.disconnectSockets(opts, close);
        }
        const request = JSON.stringify({
          uid: this.uid,
          type: RequestType.REMOTE_DISCONNECT,
          opts: {
            rooms: [...opts.rooms],
            except: [...opts.except]
          },
          close
        });
        this.pubClient.publish(this.requestChannel, request);
      }
      serverSideEmit(packet) {
        const withAck = typeof packet[packet.length - 1] === "function";
        if (withAck) {
          this.serverSideEmitWithAck(packet).catch(() => {
          });
          return;
        }
        const request = JSON.stringify({
          uid: this.uid,
          type: RequestType.SERVER_SIDE_EMIT,
          data: packet
        });
        this.pubClient.publish(this.requestChannel, request);
      }
      async serverSideEmitWithAck(packet) {
        const ack = packet.pop();
        const numSub = await this.serverCount() - 1;
        debug('waiting for %d responses to "serverSideEmit" request', numSub);
        if (numSub <= 0) {
          return ack(null, []);
        }
        const requestId = uid2(6);
        const request = JSON.stringify({
          uid: this.uid,
          requestId,
          type: RequestType.SERVER_SIDE_EMIT,
          data: packet
        });
        const timeout = setTimeout(() => {
          const storedRequest = this.requests.get(requestId);
          if (storedRequest) {
            ack(new Error(`timeout reached: only ${storedRequest.responses.length} responses received out of ${storedRequest.numSub}`), storedRequest.responses);
            this.requests.delete(requestId);
          }
        }, this.requestsTimeout);
        this.requests.set(requestId, {
          type: RequestType.SERVER_SIDE_EMIT,
          numSub,
          timeout,
          resolve: ack,
          responses: []
        });
        this.pubClient.publish(this.requestChannel, request);
      }
      serverCount() {
        return (0, util_1.PUBSUB)(this.pubClient, "NUMSUB", this.requestChannel);
      }
      close() {
        const isRedisV4 = typeof this.pubClient.pSubscribe === "function";
        if (isRedisV4) {
          this.subClient.pUnsubscribe(this.channel + "*", this.redisListeners.get("psub"), true);
          this.subClient.unsubscribe(this.requestChannel, this.redisListeners.get("sub"), true);
          this.subClient.unsubscribe(this.responseChannel, this.redisListeners.get("sub"), true);
          this.subClient.unsubscribe(this.specificResponseChannel, this.redisListeners.get("sub"), true);
        } else {
          this.subClient.punsubscribe(this.channel + "*");
          this.subClient.off("pmessageBuffer", this.redisListeners.get("pmessageBuffer"));
          this.subClient.unsubscribe([
            this.requestChannel,
            this.responseChannel,
            this.specificResponseChannel
          ]);
          this.subClient.off("messageBuffer", this.redisListeners.get("messageBuffer"));
        }
        this.pubClient.off("error", this.friendlyErrorHandler);
        this.subClient.off("error", this.friendlyErrorHandler);
      }
    };
    exports2.RedisAdapter = RedisAdapter;
    var sharded_adapter_1 = require_sharded_adapter();
    Object.defineProperty(exports2, "createShardedAdapter", { enumerable: true, get: function() {
      return sharded_adapter_1.createShardedAdapter;
    } });
  }
});

// node_modules/dotenv/config.js
(function() {
  require_main().config(
    Object.assign(
      {},
      require_env_options(),
      require_cli_options()(process.argv)
    )
  );
})();

// src/server/websocket/server.ts
var import_http = require("http");
var import_socket = require("socket.io");
var import_redis_adapter = __toESM(require_dist2());

// src/lib/logger.ts
var Logger = class {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.sensitiveKeys = ["password", "token", "secret", "authorization", "cookie", "apiKey"];
  }
  /**
   * Redact sensitive information from log context
   */
  redact(context) {
    const redacted = {};
    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveKeys.some((k) => lowerKey.includes(k));
      if (isSensitive) {
        redacted[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redact(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
  /**
   * Format log message with context
   */
  format(level, message, context) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    if (this.isDevelopment) {
      const emoji = {
        debug: "\u{1F41B}",
        info: "\u2139\uFE0F",
        warn: "\u26A0\uFE0F",
        error: "\u274C"
      }[level];
      return context ? `${emoji} [${level.toUpperCase()}] ${message} ${JSON.stringify(this.redact(context), null, 2)}` : `${emoji} [${level.toUpperCase()}] ${message}`;
    } else {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...context ? { context: this.redact(context) } : {}
      });
    }
  }
  /**
   * Debug log (development only)
   */
  debug(message, context) {
    if (this.isDevelopment) {
      console.log(this.format("debug", message, context));
    }
  }
  /**
   * Info log (always logged)
   */
  info(message, context) {
    console.log(this.format("info", message, context));
  }
  /**
   * Warning log (always logged)
   */
  warn(message, context) {
    console.warn(this.format("warn", message, context));
  }
  /**
   * Error log (always logged)
   */
  error(message, context) {
    console.error(this.format("error", message, context));
  }
};
var logger = new Logger();

// src/lib/redis.ts
var import_ioredis = __toESM(require("ioredis"));
var getEnv = (key, fallback) => {
  const val = process.env[key];
  if (!val) return fallback;
  return val.replace(/^['"]|['"]$/g, "").trim();
};
var redisUrl = getEnv("REDIS_URL", "redis://127.0.0.1:6379");
var redisPassword = getEnv("REDIS_PASSWORD", "");
var redisHost = getEnv("REDIS_HOST", "");
var redisPort = getEnv("REDIS_PORT", "6379");
var globalForRedis = global;
var redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  showFriendlyErrorStack: true,
  autoResubscribe: true,
  retryStrategy: (times) => {
    return Math.min(times * 200, 5e3);
  }
};
var redisInstance;
if (redisHost) {
  redisOptions.host = redisHost;
  redisOptions.port = parseInt(redisPort, 10);
  if (redisPassword) redisOptions.password = redisPassword;
  redisInstance = globalForRedis.redis ?? new import_ioredis.default(redisOptions);
} else {
  redisInstance = globalForRedis.redis ?? new import_ioredis.default(redisUrl, redisOptions);
}
var redis = redisInstance;
redis.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
if (process.env.NODE_ENV === "production") {
  const shutdown2 = async () => {
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown2);
  process.on("SIGINT", shutdown2);
}

// node_modules/xstate/dev/dist/xstate-dev.esm.js
function getGlobal() {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
}
function getDevTools() {
  const w = getGlobal();
  if (w.__xstate__) {
    return w.__xstate__;
  }
  return void 0;
}
var devToolsAdapter = (service) => {
  if (typeof window === "undefined") {
    return;
  }
  const devTools = getDevTools();
  if (devTools) {
    devTools.register(service);
  }
};

// node_modules/xstate/dist/raise-34c45204.esm.js
var Mailbox = class {
  constructor(_process) {
    this._process = _process;
    this._active = false;
    this._current = null;
    this._last = null;
  }
  start() {
    this._active = true;
    this.flush();
  }
  clear() {
    if (this._current) {
      this._current.next = null;
      this._last = this._current;
    }
  }
  enqueue(event) {
    const enqueued = {
      value: event,
      next: null
    };
    if (this._current) {
      this._last.next = enqueued;
      this._last = enqueued;
      return;
    }
    this._current = enqueued;
    this._last = enqueued;
    if (this._active) {
      this.flush();
    }
  }
  flush() {
    while (this._current) {
      const consumed = this._current;
      this._process(consumed.value);
      this._current = consumed.next;
    }
    this._last = null;
  }
};
var STATE_DELIMITER = ".";
var TARGETLESS_KEY = "";
var NULL_EVENT = "";
var STATE_IDENTIFIER = "#";
var WILDCARD = "*";
var XSTATE_INIT = "xstate.init";
var XSTATE_STOP = "xstate.stop";
function createAfterEvent(delayRef, id) {
  return {
    type: `xstate.after.${delayRef}.${id}`
  };
}
function createDoneStateEvent(id, output) {
  return {
    type: `xstate.done.state.${id}`,
    output
  };
}
function createDoneActorEvent(invokeId, output) {
  return {
    type: `xstate.done.actor.${invokeId}`,
    output,
    actorId: invokeId
  };
}
function createErrorActorEvent(id, error) {
  return {
    type: `xstate.error.actor.${id}`,
    error,
    actorId: id
  };
}
function createInitEvent(input) {
  return {
    type: XSTATE_INIT,
    input
  };
}
function reportUnhandledError(err) {
  setTimeout(() => {
    throw err;
  });
}
var symbolObservable = (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
function matchesState(parentStateId, childStateId) {
  const parentStateValue = toStateValue(parentStateId);
  const childStateValue = toStateValue(childStateId);
  if (typeof childStateValue === "string") {
    if (typeof parentStateValue === "string") {
      return childStateValue === parentStateValue;
    }
    return false;
  }
  if (typeof parentStateValue === "string") {
    return parentStateValue in childStateValue;
  }
  return Object.keys(parentStateValue).every((key) => {
    if (!(key in childStateValue)) {
      return false;
    }
    return matchesState(parentStateValue[key], childStateValue[key]);
  });
}
function toStatePath(stateId) {
  if (isArray(stateId)) {
    return stateId;
  }
  const result = [];
  let segment = "";
  for (let i = 0; i < stateId.length; i++) {
    const char = stateId.charCodeAt(i);
    switch (char) {
      // \
      case 92:
        segment += stateId[i + 1];
        i++;
        continue;
      // .
      case 46:
        result.push(segment);
        segment = "";
        continue;
    }
    segment += stateId[i];
  }
  result.push(segment);
  return result;
}
function toStateValue(stateValue) {
  if (isMachineSnapshot(stateValue)) {
    return stateValue.value;
  }
  if (typeof stateValue !== "string") {
    return stateValue;
  }
  const statePath = toStatePath(stateValue);
  return pathToStateValue(statePath);
}
function pathToStateValue(statePath) {
  if (statePath.length === 1) {
    return statePath[0];
  }
  const value = {};
  let marker = value;
  for (let i = 0; i < statePath.length - 1; i++) {
    if (i === statePath.length - 2) {
      marker[statePath[i]] = statePath[i + 1];
    } else {
      const previous = marker;
      marker = {};
      previous[statePath[i]] = marker;
    }
  }
  return value;
}
function mapValues(collection, iteratee) {
  const result = {};
  const collectionKeys = Object.keys(collection);
  for (let i = 0; i < collectionKeys.length; i++) {
    const key = collectionKeys[i];
    result[key] = iteratee(collection[key], key, collection, i);
  }
  return result;
}
function toArrayStrict(value) {
  if (isArray(value)) {
    return value;
  }
  return [value];
}
function toArray(value) {
  if (value === void 0) {
    return [];
  }
  return toArrayStrict(value);
}
function resolveOutput(mapper, context, event, self2) {
  if (typeof mapper === "function") {
    return mapper({
      context,
      event,
      self: self2
    });
  }
  return mapper;
}
function isArray(value) {
  return Array.isArray(value);
}
function isErrorActorEvent(event) {
  return event.type.startsWith("xstate.error.actor");
}
function toTransitionConfigArray(configLike) {
  return toArrayStrict(configLike).map((transitionLike) => {
    if (typeof transitionLike === "undefined" || typeof transitionLike === "string") {
      return {
        target: transitionLike
      };
    }
    return transitionLike;
  });
}
function normalizeTarget(target) {
  if (target === void 0 || target === TARGETLESS_KEY) {
    return void 0;
  }
  return toArray(target);
}
function toObserver(nextHandler, errorHandler, completionHandler) {
  const isObserver = typeof nextHandler === "object";
  const self2 = isObserver ? nextHandler : void 0;
  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self2),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self2),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(self2)
  };
}
function createInvokeId(stateNodeId, index) {
  return `${index}.${stateNodeId}`;
}
function resolveReferencedActor(machine, src) {
  const match = src.match(/^xstate\.invoke\.(\d+)\.(.*)/);
  if (!match) {
    return machine.implementations.actors[src];
  }
  const [, indexStr, nodeId] = match;
  const node = machine.getStateNodeById(nodeId);
  const invokeConfig = node.config.invoke;
  return (Array.isArray(invokeConfig) ? invokeConfig[indexStr] : invokeConfig).src;
}
function matchesEventDescriptor(eventType, descriptor) {
  if (descriptor === eventType) {
    return true;
  }
  if (descriptor === WILDCARD) {
    return true;
  }
  if (!descriptor.endsWith(".*")) {
    return false;
  }
  const partialEventTokens = descriptor.split(".");
  const eventTokens = eventType.split(".");
  for (let tokenIndex = 0; tokenIndex < partialEventTokens.length; tokenIndex++) {
    const partialEventToken = partialEventTokens[tokenIndex];
    const eventToken = eventTokens[tokenIndex];
    if (partialEventToken === "*") {
      const isLastToken = tokenIndex === partialEventTokens.length - 1;
      return isLastToken;
    }
    if (partialEventToken !== eventToken) {
      return false;
    }
  }
  return true;
}
function createScheduledEventId(actorRef, id) {
  return `${actorRef.sessionId}.${id}`;
}
var idCounter = 0;
function createSystem(rootActor, options) {
  const children = /* @__PURE__ */ new Map();
  const keyedActors = /* @__PURE__ */ new Map();
  const reverseKeyedActors = /* @__PURE__ */ new WeakMap();
  const inspectionObservers = /* @__PURE__ */ new Set();
  const timerMap = {};
  const {
    clock,
    logger: logger2
  } = options;
  const scheduler = {
    schedule: (source, target, event, delay, id = Math.random().toString(36).slice(2)) => {
      const scheduledEvent = {
        source,
        target,
        event,
        delay,
        id,
        startedAt: Date.now()
      };
      const scheduledEventId = createScheduledEventId(source, id);
      system._snapshot._scheduledEvents[scheduledEventId] = scheduledEvent;
      const timeout = clock.setTimeout(() => {
        delete timerMap[scheduledEventId];
        delete system._snapshot._scheduledEvents[scheduledEventId];
        system._relay(source, target, event);
      }, delay);
      timerMap[scheduledEventId] = timeout;
    },
    cancel: (source, id) => {
      const scheduledEventId = createScheduledEventId(source, id);
      const timeout = timerMap[scheduledEventId];
      delete timerMap[scheduledEventId];
      delete system._snapshot._scheduledEvents[scheduledEventId];
      if (timeout !== void 0) {
        clock.clearTimeout(timeout);
      }
    },
    cancelAll: (actorRef) => {
      for (const scheduledEventId in system._snapshot._scheduledEvents) {
        const scheduledEvent = system._snapshot._scheduledEvents[scheduledEventId];
        if (scheduledEvent.source === actorRef) {
          scheduler.cancel(actorRef, scheduledEvent.id);
        }
      }
    }
  };
  const sendInspectionEvent = (event) => {
    if (!inspectionObservers.size) {
      return;
    }
    const resolvedInspectionEvent = {
      ...event,
      rootId: rootActor.sessionId
    };
    inspectionObservers.forEach((observer) => observer.next?.(resolvedInspectionEvent));
  };
  const system = {
    _snapshot: {
      _scheduledEvents: (options?.snapshot && options.snapshot.scheduler) ?? {}
    },
    _bookId: () => `x:${idCounter++}`,
    _register: (sessionId, actorRef) => {
      children.set(sessionId, actorRef);
      return sessionId;
    },
    _unregister: (actorRef) => {
      children.delete(actorRef.sessionId);
      const systemId = reverseKeyedActors.get(actorRef);
      if (systemId !== void 0) {
        keyedActors.delete(systemId);
        reverseKeyedActors.delete(actorRef);
      }
    },
    get: (systemId) => {
      return keyedActors.get(systemId);
    },
    getAll: () => {
      return Object.fromEntries(keyedActors.entries());
    },
    _set: (systemId, actorRef) => {
      const existing = keyedActors.get(systemId);
      if (existing && existing !== actorRef) {
        throw new Error(`Actor with system ID '${systemId}' already exists.`);
      }
      keyedActors.set(systemId, actorRef);
      reverseKeyedActors.set(actorRef, systemId);
    },
    inspect: (observerOrFn) => {
      const observer = toObserver(observerOrFn);
      inspectionObservers.add(observer);
      return {
        unsubscribe() {
          inspectionObservers.delete(observer);
        }
      };
    },
    _sendInspectionEvent: sendInspectionEvent,
    _relay: (source, target, event) => {
      system._sendInspectionEvent({
        type: "@xstate.event",
        sourceRef: source,
        actorRef: target,
        event
      });
      target._send(event);
    },
    scheduler,
    getSnapshot: () => {
      return {
        _scheduledEvents: {
          ...system._snapshot._scheduledEvents
        }
      };
    },
    start: () => {
      const scheduledEvents = system._snapshot._scheduledEvents;
      system._snapshot._scheduledEvents = {};
      for (const scheduledId in scheduledEvents) {
        const {
          source,
          target,
          event,
          delay,
          id
        } = scheduledEvents[scheduledId];
        scheduler.schedule(source, target, event, delay, id);
      }
    },
    _clock: clock,
    _logger: logger2
  };
  return system;
}
var executingCustomAction = false;
var $$ACTOR_TYPE = 1;
var ProcessingStatus = /* @__PURE__ */ (function(ProcessingStatus2) {
  ProcessingStatus2[ProcessingStatus2["NotStarted"] = 0] = "NotStarted";
  ProcessingStatus2[ProcessingStatus2["Running"] = 1] = "Running";
  ProcessingStatus2[ProcessingStatus2["Stopped"] = 2] = "Stopped";
  return ProcessingStatus2;
})({});
var defaultOptions = {
  clock: {
    setTimeout: (fn, ms) => {
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => {
      return clearTimeout(id);
    }
  },
  logger: console.log.bind(console),
  devTools: false
};
var Actor = class {
  /**
   * Creates a new actor instance for the given logic with the provided options,
   * if any.
   *
   * @param logic The logic to create an actor from
   * @param options Actor options
   */
  constructor(logic, options) {
    this.logic = logic;
    this._snapshot = void 0;
    this.clock = void 0;
    this.options = void 0;
    this.id = void 0;
    this.mailbox = new Mailbox(this._process.bind(this));
    this.observers = /* @__PURE__ */ new Set();
    this.eventListeners = /* @__PURE__ */ new Map();
    this.logger = void 0;
    this._processingStatus = ProcessingStatus.NotStarted;
    this._parent = void 0;
    this._syncSnapshot = void 0;
    this.ref = void 0;
    this._actorScope = void 0;
    this.systemId = void 0;
    this.sessionId = void 0;
    this.system = void 0;
    this._doneEvent = void 0;
    this.src = void 0;
    this._deferred = [];
    const resolvedOptions = {
      ...defaultOptions,
      ...options
    };
    const {
      clock,
      logger: logger2,
      parent,
      syncSnapshot,
      id,
      systemId,
      inspect
    } = resolvedOptions;
    this.system = parent ? parent.system : createSystem(this, {
      clock,
      logger: logger2
    });
    if (inspect && !parent) {
      this.system.inspect(toObserver(inspect));
    }
    this.sessionId = this.system._bookId();
    this.id = id ?? this.sessionId;
    this.logger = options?.logger ?? this.system._logger;
    this.clock = options?.clock ?? this.system._clock;
    this._parent = parent;
    this._syncSnapshot = syncSnapshot;
    this.options = resolvedOptions;
    this.src = resolvedOptions.src ?? logic;
    this.ref = this;
    this._actorScope = {
      self: this,
      id: this.id,
      sessionId: this.sessionId,
      logger: this.logger,
      defer: (fn) => {
        this._deferred.push(fn);
      },
      system: this.system,
      stopChild: (child) => {
        if (child._parent !== this) {
          throw new Error(`Cannot stop child actor ${child.id} of ${this.id} because it is not a child`);
        }
        child._stop();
      },
      emit: (emittedEvent) => {
        const listeners = this.eventListeners.get(emittedEvent.type);
        const wildcardListener = this.eventListeners.get("*");
        if (!listeners && !wildcardListener) {
          return;
        }
        const allListeners = [...listeners ? listeners.values() : [], ...wildcardListener ? wildcardListener.values() : []];
        for (const handler of allListeners) {
          try {
            handler(emittedEvent);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
      },
      actionExecutor: (action) => {
        const exec = () => {
          this._actorScope.system._sendInspectionEvent({
            type: "@xstate.action",
            actorRef: this,
            action: {
              type: action.type,
              params: action.params
            }
          });
          if (!action.exec) {
            return;
          }
          const saveExecutingCustomAction = executingCustomAction;
          try {
            executingCustomAction = true;
            action.exec(action.info, action.params);
          } finally {
            executingCustomAction = saveExecutingCustomAction;
          }
        };
        if (this._processingStatus === ProcessingStatus.Running) {
          exec();
        } else {
          this._deferred.push(exec);
        }
      }
    };
    this.send = this.send.bind(this);
    this.system._sendInspectionEvent({
      type: "@xstate.actor",
      actorRef: this
    });
    if (systemId) {
      this.systemId = systemId;
      this.system._set(systemId, this);
    }
    this._initState(options?.snapshot ?? options?.state);
    if (systemId && this._snapshot.status !== "active") {
      this.system._unregister(this);
    }
  }
  _initState(persistedState) {
    try {
      this._snapshot = persistedState ? this.logic.restoreSnapshot ? this.logic.restoreSnapshot(persistedState, this._actorScope) : persistedState : this.logic.getInitialSnapshot(this._actorScope, this.options?.input);
    } catch (err) {
      this._snapshot = {
        status: "error",
        output: void 0,
        error: err
      };
    }
  }
  update(snapshot, event) {
    this._snapshot = snapshot;
    let deferredFn;
    while (deferredFn = this._deferred.shift()) {
      try {
        deferredFn();
      } catch (err) {
        this._deferred.length = 0;
        this._snapshot = {
          ...snapshot,
          status: "error",
          error: err
        };
      }
    }
    switch (this._snapshot.status) {
      case "active":
        for (const observer of this.observers) {
          try {
            observer.next?.(snapshot);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
        break;
      case "done":
        for (const observer of this.observers) {
          try {
            observer.next?.(snapshot);
          } catch (err) {
            reportUnhandledError(err);
          }
        }
        this._stopProcedure();
        this._complete();
        this._doneEvent = createDoneActorEvent(this.id, this._snapshot.output);
        if (this._parent) {
          this.system._relay(this, this._parent, this._doneEvent);
        }
        break;
      case "error":
        this._error(this._snapshot.error);
        break;
    }
    this.system._sendInspectionEvent({
      type: "@xstate.snapshot",
      actorRef: this,
      event,
      snapshot
    });
  }
  /**
   * Subscribe an observer to an actor’s snapshot values.
   *
   * @remarks
   * The observer will receive the actor’s snapshot value when it is emitted.
   * The observer can be:
   *
   * - A plain function that receives the latest snapshot, or
   * - An observer object whose `.next(snapshot)` method receives the latest
   *   snapshot
   *
   * @example
   *
   * ```ts
   * // Observer as a plain function
   * const subscription = actor.subscribe((snapshot) => {
   *   console.log(snapshot);
   * });
   * ```
   *
   * @example
   *
   * ```ts
   * // Observer as an object
   * const subscription = actor.subscribe({
   *   next(snapshot) {
   *     console.log(snapshot);
   *   },
   *   error(err) {
   *     // ...
   *   },
   *   complete() {
   *     // ...
   *   }
   * });
   * ```
   *
   * The return value of `actor.subscribe(observer)` is a subscription object
   * that has an `.unsubscribe()` method. You can call
   * `subscription.unsubscribe()` to unsubscribe the observer:
   *
   * @example
   *
   * ```ts
   * const subscription = actor.subscribe((snapshot) => {
   *   // ...
   * });
   *
   * // Unsubscribe the observer
   * subscription.unsubscribe();
   * ```
   *
   * When the actor is stopped, all of its observers will automatically be
   * unsubscribed.
   *
   * @param observer - Either a plain function that receives the latest
   *   snapshot, or an observer object whose `.next(snapshot)` method receives
   *   the latest snapshot
   */
  subscribe(nextListenerOrObserver, errorListener, completeListener) {
    const observer = toObserver(nextListenerOrObserver, errorListener, completeListener);
    if (this._processingStatus !== ProcessingStatus.Stopped) {
      this.observers.add(observer);
    } else {
      switch (this._snapshot.status) {
        case "done":
          try {
            observer.complete?.();
          } catch (err) {
            reportUnhandledError(err);
          }
          break;
        case "error": {
          const err = this._snapshot.error;
          if (!observer.error) {
            reportUnhandledError(err);
          } else {
            try {
              observer.error(err);
            } catch (err2) {
              reportUnhandledError(err2);
            }
          }
          break;
        }
      }
    }
    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }
  on(type, handler) {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.eventListeners.set(type, listeners);
    }
    const wrappedHandler = handler.bind(void 0);
    listeners.add(wrappedHandler);
    return {
      unsubscribe: () => {
        listeners.delete(wrappedHandler);
      }
    };
  }
  /** Starts the Actor from the initial state */
  start() {
    if (this._processingStatus === ProcessingStatus.Running) {
      return this;
    }
    if (this._syncSnapshot) {
      this.subscribe({
        next: (snapshot) => {
          if (snapshot.status === "active") {
            this.system._relay(this, this._parent, {
              type: `xstate.snapshot.${this.id}`,
              snapshot
            });
          }
        },
        error: () => {
        }
      });
    }
    this.system._register(this.sessionId, this);
    if (this.systemId) {
      this.system._set(this.systemId, this);
    }
    this._processingStatus = ProcessingStatus.Running;
    const initEvent = createInitEvent(this.options.input);
    this.system._sendInspectionEvent({
      type: "@xstate.event",
      sourceRef: this._parent,
      actorRef: this,
      event: initEvent
    });
    const status = this._snapshot.status;
    switch (status) {
      case "done":
        this.update(this._snapshot, initEvent);
        return this;
      case "error":
        this._error(this._snapshot.error);
        return this;
    }
    if (!this._parent) {
      this.system.start();
    }
    if (this.logic.start) {
      try {
        this.logic.start(this._snapshot, this._actorScope);
      } catch (err) {
        this._snapshot = {
          ...this._snapshot,
          status: "error",
          error: err
        };
        this._error(err);
        return this;
      }
    }
    this.update(this._snapshot, initEvent);
    if (this.options.devTools) {
      this.attachDevTools();
    }
    this.mailbox.start();
    return this;
  }
  _process(event) {
    let nextState;
    let caughtError;
    try {
      nextState = this.logic.transition(this._snapshot, event, this._actorScope);
    } catch (err) {
      caughtError = {
        err
      };
    }
    if (caughtError) {
      const {
        err
      } = caughtError;
      this._snapshot = {
        ...this._snapshot,
        status: "error",
        error: err
      };
      this._error(err);
      return;
    }
    this.update(nextState, event);
    if (event.type === XSTATE_STOP) {
      this._stopProcedure();
      this._complete();
    }
  }
  _stop() {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return this;
    }
    this.mailbox.clear();
    if (this._processingStatus === ProcessingStatus.NotStarted) {
      this._processingStatus = ProcessingStatus.Stopped;
      return this;
    }
    this.mailbox.enqueue({
      type: XSTATE_STOP
    });
    return this;
  }
  /** Stops the Actor and unsubscribe all listeners. */
  stop() {
    if (this._parent) {
      throw new Error("A non-root actor cannot be stopped directly.");
    }
    return this._stop();
  }
  _complete() {
    for (const observer of this.observers) {
      try {
        observer.complete?.();
      } catch (err) {
        reportUnhandledError(err);
      }
    }
    this.observers.clear();
    this.eventListeners.clear();
  }
  _reportError(err) {
    if (!this.observers.size) {
      if (!this._parent) {
        reportUnhandledError(err);
      }
      this.eventListeners.clear();
      return;
    }
    let reportError = false;
    for (const observer of this.observers) {
      const errorListener = observer.error;
      reportError ||= !errorListener;
      try {
        errorListener?.(err);
      } catch (err2) {
        reportUnhandledError(err2);
      }
    }
    this.observers.clear();
    this.eventListeners.clear();
    if (reportError) {
      reportUnhandledError(err);
    }
  }
  _error(err) {
    this._stopProcedure();
    this._reportError(err);
    if (this._parent) {
      this.system._relay(this, this._parent, createErrorActorEvent(this.id, err));
    }
  }
  // TODO: atm children don't belong entirely to the actor so
  // in a way - it's not even super aware of them
  // so we can't stop them from here but we really should!
  // right now, they are being stopped within the machine's transition
  // but that could throw and leave us with "orphaned" active actors
  _stopProcedure() {
    if (this._processingStatus !== ProcessingStatus.Running) {
      return this;
    }
    this.system.scheduler.cancelAll(this);
    this.mailbox.clear();
    this.mailbox = new Mailbox(this._process.bind(this));
    this._processingStatus = ProcessingStatus.Stopped;
    this.system._unregister(this);
    return this;
  }
  /** @internal */
  _send(event) {
    if (this._processingStatus === ProcessingStatus.Stopped) {
      return;
    }
    this.mailbox.enqueue(event);
  }
  /**
   * Sends an event to the running Actor to trigger a transition.
   *
   * @param event The event to send
   */
  send(event) {
    this.system._relay(void 0, this, event);
  }
  attachDevTools() {
    const {
      devTools
    } = this.options;
    if (devTools) {
      const resolvedDevToolsAdapter = typeof devTools === "function" ? devTools : devToolsAdapter;
      resolvedDevToolsAdapter(this);
    }
  }
  toJSON() {
    return {
      xstate$$type: $$ACTOR_TYPE,
      id: this.id
    };
  }
  /**
   * Obtain the internal state of the actor, which can be persisted.
   *
   * @remarks
   * The internal state can be persisted from any actor, not only machines.
   *
   * Note that the persisted state is not the same as the snapshot from
   * {@link Actor.getSnapshot}. Persisted state represents the internal state of
   * the actor, while snapshots represent the actor's last emitted value.
   *
   * Can be restored with {@link ActorOptions.state}
   * @see https://stately.ai/docs/persistence
   */
  getPersistedSnapshot(options) {
    return this.logic.getPersistedSnapshot(this._snapshot, options);
  }
  [symbolObservable]() {
    return this;
  }
  /**
   * Read an actor’s snapshot synchronously.
   *
   * @remarks
   * The snapshot represent an actor's last emitted value.
   *
   * When an actor receives an event, its internal state may change. An actor
   * may emit a snapshot when a state transition occurs.
   *
   * Note that some actors, such as callback actors generated with
   * `fromCallback`, will not emit snapshots.
   * @see {@link Actor.subscribe} to subscribe to an actor’s snapshot values.
   * @see {@link Actor.getPersistedSnapshot} to persist the internal state of an actor (which is more than just a snapshot).
   */
  getSnapshot() {
    return this._snapshot;
  }
};
function createActor(logic, ...[options]) {
  return new Actor(logic, options);
}
function resolveCancel(_, snapshot, actionArgs, actionParams, {
  sendId
}) {
  const resolvedSendId = typeof sendId === "function" ? sendId(actionArgs, actionParams) : sendId;
  return [snapshot, {
    sendId: resolvedSendId
  }, void 0];
}
function executeCancel(actorScope, params) {
  actorScope.defer(() => {
    actorScope.system.scheduler.cancel(actorScope.self, params.sendId);
  });
}
function cancel(sendId) {
  function cancel2(_args, _params) {
  }
  cancel2.type = "xstate.cancel";
  cancel2.sendId = sendId;
  cancel2.resolve = resolveCancel;
  cancel2.execute = executeCancel;
  return cancel2;
}
function resolveSpawn(actorScope, snapshot, actionArgs, _actionParams, {
  id,
  systemId,
  src,
  input,
  syncSnapshot
}) {
  const logic = typeof src === "string" ? resolveReferencedActor(snapshot.machine, src) : src;
  const resolvedId = typeof id === "function" ? id(actionArgs) : id;
  let actorRef;
  let resolvedInput = void 0;
  if (logic) {
    resolvedInput = typeof input === "function" ? input({
      context: snapshot.context,
      event: actionArgs.event,
      self: actorScope.self
    }) : input;
    actorRef = createActor(logic, {
      id: resolvedId,
      src,
      parent: actorScope.self,
      syncSnapshot,
      systemId,
      input: resolvedInput
    });
  }
  return [cloneMachineSnapshot(snapshot, {
    children: {
      ...snapshot.children,
      [resolvedId]: actorRef
    }
  }), {
    id,
    systemId,
    actorRef,
    src,
    input: resolvedInput
  }, void 0];
}
function executeSpawn(actorScope, {
  actorRef
}) {
  if (!actorRef) {
    return;
  }
  actorScope.defer(() => {
    if (actorRef._processingStatus === ProcessingStatus.Stopped) {
      return;
    }
    actorRef.start();
  });
}
function spawnChild(...[src, {
  id,
  systemId,
  input,
  syncSnapshot = false
} = {}]) {
  function spawnChild2(_args, _params) {
  }
  spawnChild2.type = "xstate.spawnChild";
  spawnChild2.id = id;
  spawnChild2.systemId = systemId;
  spawnChild2.src = src;
  spawnChild2.input = input;
  spawnChild2.syncSnapshot = syncSnapshot;
  spawnChild2.resolve = resolveSpawn;
  spawnChild2.execute = executeSpawn;
  return spawnChild2;
}
function resolveStop(_, snapshot, args, actionParams, {
  actorRef
}) {
  const actorRefOrString = typeof actorRef === "function" ? actorRef(args, actionParams) : actorRef;
  const resolvedActorRef = typeof actorRefOrString === "string" ? snapshot.children[actorRefOrString] : actorRefOrString;
  let children = snapshot.children;
  if (resolvedActorRef) {
    children = {
      ...children
    };
    delete children[resolvedActorRef.id];
  }
  return [cloneMachineSnapshot(snapshot, {
    children
  }), resolvedActorRef, void 0];
}
function unregisterRecursively(actorScope, actorRef) {
  const snapshot = actorRef.getSnapshot();
  if (snapshot && "children" in snapshot) {
    for (const child of Object.values(snapshot.children)) {
      unregisterRecursively(actorScope, child);
    }
  }
  actorScope.system._unregister(actorRef);
}
function executeStop(actorScope, actorRef) {
  if (!actorRef) {
    return;
  }
  unregisterRecursively(actorScope, actorRef);
  if (actorRef._processingStatus !== ProcessingStatus.Running) {
    actorScope.stopChild(actorRef);
    return;
  }
  actorScope.defer(() => {
    actorScope.stopChild(actorRef);
  });
}
function stopChild(actorRef) {
  function stop2(_args, _params) {
  }
  stop2.type = "xstate.stopChild";
  stop2.actorRef = actorRef;
  stop2.resolve = resolveStop;
  stop2.execute = executeStop;
  return stop2;
}
function evaluateGuard(guard, context, event, snapshot) {
  const {
    machine
  } = snapshot;
  const isInline = typeof guard === "function";
  const resolved = isInline ? guard : machine.implementations.guards[typeof guard === "string" ? guard : guard.type];
  if (!isInline && !resolved) {
    throw new Error(`Guard '${typeof guard === "string" ? guard : guard.type}' is not implemented.'.`);
  }
  if (typeof resolved !== "function") {
    return evaluateGuard(resolved, context, event, snapshot);
  }
  const guardArgs = {
    context,
    event
  };
  const guardParams = isInline || typeof guard === "string" ? void 0 : "params" in guard ? typeof guard.params === "function" ? guard.params({
    context,
    event
  }) : guard.params : void 0;
  if (!("check" in resolved)) {
    return resolved(guardArgs, guardParams);
  }
  const builtinGuard = resolved;
  return builtinGuard.check(
    snapshot,
    guardArgs,
    resolved
    // this holds all params
  );
}
function isAtomicStateNode(stateNode) {
  return stateNode.type === "atomic" || stateNode.type === "final";
}
function getChildren(stateNode) {
  return Object.values(stateNode.states).filter((sn) => sn.type !== "history");
}
function getProperAncestors(stateNode, toStateNode) {
  const ancestors = [];
  if (toStateNode === stateNode) {
    return ancestors;
  }
  let m = stateNode.parent;
  while (m && m !== toStateNode) {
    ancestors.push(m);
    m = m.parent;
  }
  return ancestors;
}
function getAllStateNodes(stateNodes) {
  const nodeSet = new Set(stateNodes);
  const adjList = getAdjList(nodeSet);
  for (const s of nodeSet) {
    if (s.type === "compound" && (!adjList.get(s) || !adjList.get(s).length)) {
      getInitialStateNodesWithTheirAncestors(s).forEach((sn) => nodeSet.add(sn));
    } else {
      if (s.type === "parallel") {
        for (const child of getChildren(s)) {
          if (child.type === "history") {
            continue;
          }
          if (!nodeSet.has(child)) {
            const initialStates = getInitialStateNodesWithTheirAncestors(child);
            for (const initialStateNode of initialStates) {
              nodeSet.add(initialStateNode);
            }
          }
        }
      }
    }
  }
  for (const s of nodeSet) {
    let m = s.parent;
    while (m) {
      nodeSet.add(m);
      m = m.parent;
    }
  }
  return nodeSet;
}
function getValueFromAdj(baseNode, adjList) {
  const childStateNodes = adjList.get(baseNode);
  if (!childStateNodes) {
    return {};
  }
  if (baseNode.type === "compound") {
    const childStateNode = childStateNodes[0];
    if (childStateNode) {
      if (isAtomicStateNode(childStateNode)) {
        return childStateNode.key;
      }
    } else {
      return {};
    }
  }
  const stateValue = {};
  for (const childStateNode of childStateNodes) {
    stateValue[childStateNode.key] = getValueFromAdj(childStateNode, adjList);
  }
  return stateValue;
}
function getAdjList(stateNodes) {
  const adjList = /* @__PURE__ */ new Map();
  for (const s of stateNodes) {
    if (!adjList.has(s)) {
      adjList.set(s, []);
    }
    if (s.parent) {
      if (!adjList.has(s.parent)) {
        adjList.set(s.parent, []);
      }
      adjList.get(s.parent).push(s);
    }
  }
  return adjList;
}
function getStateValue(rootNode, stateNodes) {
  const config = getAllStateNodes(stateNodes);
  return getValueFromAdj(rootNode, getAdjList(config));
}
function isInFinalState(stateNodeSet, stateNode) {
  if (stateNode.type === "compound") {
    return getChildren(stateNode).some((s) => s.type === "final" && stateNodeSet.has(s));
  }
  if (stateNode.type === "parallel") {
    return getChildren(stateNode).every((sn) => isInFinalState(stateNodeSet, sn));
  }
  return stateNode.type === "final";
}
var isStateId = (str) => str[0] === STATE_IDENTIFIER;
function getCandidates(stateNode, receivedEventType) {
  const candidates = stateNode.transitions.get(receivedEventType) || [...stateNode.transitions.keys()].filter((eventDescriptor) => matchesEventDescriptor(receivedEventType, eventDescriptor)).sort((a, b) => b.length - a.length).flatMap((key) => stateNode.transitions.get(key));
  return candidates;
}
function getDelayedTransitions(stateNode) {
  const afterConfig = stateNode.config.after;
  if (!afterConfig) {
    return [];
  }
  const mutateEntryExit = (delay) => {
    const afterEvent = createAfterEvent(delay, stateNode.id);
    const eventType = afterEvent.type;
    stateNode.entry.push(raise(afterEvent, {
      id: eventType,
      delay
    }));
    stateNode.exit.push(cancel(eventType));
    return eventType;
  };
  const delayedTransitions = Object.keys(afterConfig).flatMap((delay) => {
    const configTransition = afterConfig[delay];
    const resolvedTransition = typeof configTransition === "string" ? {
      target: configTransition
    } : configTransition;
    const resolvedDelay = Number.isNaN(+delay) ? delay : +delay;
    const eventType = mutateEntryExit(resolvedDelay);
    return toArray(resolvedTransition).map((transition) => ({
      ...transition,
      event: eventType,
      delay: resolvedDelay
    }));
  });
  return delayedTransitions.map((delayedTransition) => {
    const {
      delay
    } = delayedTransition;
    return {
      ...formatTransition(stateNode, delayedTransition.event, delayedTransition),
      delay
    };
  });
}
function formatTransition(stateNode, descriptor, transitionConfig) {
  const normalizedTarget = normalizeTarget(transitionConfig.target);
  const reenter = transitionConfig.reenter ?? false;
  const target = resolveTarget(stateNode, normalizedTarget);
  const transition = {
    ...transitionConfig,
    actions: toArray(transitionConfig.actions),
    guard: transitionConfig.guard,
    target,
    source: stateNode,
    reenter,
    eventType: descriptor,
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: target ? target.map((t) => `#${t.id}`) : void 0
    })
  };
  return transition;
}
function formatTransitions(stateNode) {
  const transitions = /* @__PURE__ */ new Map();
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error('Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.');
      }
      const transitionsConfig = stateNode.config.on[descriptor];
      transitions.set(descriptor, toTransitionConfigArray(transitionsConfig).map((t) => formatTransition(stateNode, descriptor, t)));
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = `xstate.done.state.${stateNode.id}`;
    transitions.set(descriptor, toTransitionConfigArray(stateNode.config.onDone).map((t) => formatTransition(stateNode, descriptor, t)));
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onDone).map((t) => formatTransition(stateNode, descriptor, t)));
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onError).map((t) => formatTransition(stateNode, descriptor, t)));
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(descriptor, toTransitionConfigArray(invokeDef.onSnapshot).map((t) => formatTransition(stateNode, descriptor, t)));
    }
  }
  for (const delayedTransition of stateNode.after) {
    let existing = transitions.get(delayedTransition.eventType);
    if (!existing) {
      existing = [];
      transitions.set(delayedTransition.eventType, existing);
    }
    existing.push(delayedTransition);
  }
  return transitions;
}
function formatRouteTransitions(rootStateNode) {
  const routeTransitions = [];
  const collectRoutes = (states) => {
    Object.values(states).forEach((sn) => {
      if (sn.config.route && sn.config.id) {
        const routeId = sn.config.id;
        const userGuard = sn.config.route.guard;
        const routeGuard = (args, params) => {
          if (args.event.to !== `#${routeId}`) {
            return false;
          }
          if (!userGuard) {
            return true;
          }
          if (typeof userGuard === "function") {
            return userGuard(args, params);
          }
          return true;
        };
        const transition = {
          ...sn.config.route,
          guard: routeGuard,
          target: `#${routeId}`
        };
        routeTransitions.push(formatTransition(rootStateNode, "xstate.route", transition));
      }
      if (sn.states) {
        collectRoutes(sn.states);
      }
    });
  };
  collectRoutes(rootStateNode.states);
  if (routeTransitions.length > 0) {
    rootStateNode.transitions.set("xstate.route", routeTransitions);
  }
}
function formatInitialTransition(stateNode, _target) {
  const resolvedTarget = typeof _target === "string" ? stateNode.states[_target] : _target ? stateNode.states[_target.target] : void 0;
  if (!resolvedTarget && _target) {
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
      `Initial state node "${_target}" not found on parent state node #${stateNode.id}`
    );
  }
  const transition = {
    source: stateNode,
    actions: !_target || typeof _target === "string" ? [] : toArray(_target.actions),
    eventType: null,
    reenter: false,
    target: resolvedTarget ? [resolvedTarget] : [],
    toJSON: () => ({
      ...transition,
      source: `#${stateNode.id}`,
      target: resolvedTarget ? [`#${resolvedTarget.id}`] : []
    })
  };
  return transition;
}
function resolveTarget(stateNode, targets) {
  if (targets === void 0) {
    return void 0;
  }
  return targets.map((target) => {
    if (typeof target !== "string") {
      return target;
    }
    if (isStateId(target)) {
      return stateNode.machine.getStateNodeById(target);
    }
    const isInternalTarget = target[0] === STATE_DELIMITER;
    if (isInternalTarget && !stateNode.parent) {
      return getStateNodeByPath(stateNode, target.slice(1));
    }
    const resolvedTarget = isInternalTarget ? stateNode.key + target : target;
    if (stateNode.parent) {
      try {
        const targetStateNode = getStateNodeByPath(stateNode.parent, resolvedTarget);
        return targetStateNode;
      } catch (err) {
        throw new Error(`Invalid transition definition for state node '${stateNode.id}':
${err.message}`);
      }
    } else {
      throw new Error(`Invalid target: "${target}" is not a valid target from the root node. Did you mean ".${target}"?`);
    }
  });
}
function resolveHistoryDefaultTransition(stateNode) {
  const normalizedTarget = normalizeTarget(stateNode.config.target);
  if (!normalizedTarget) {
    return stateNode.parent.initial;
  }
  return {
    target: normalizedTarget.map((t) => typeof t === "string" ? getStateNodeByPath(stateNode.parent, t) : t)
  };
}
function isHistoryNode(stateNode) {
  return stateNode.type === "history";
}
function getInitialStateNodesWithTheirAncestors(stateNode) {
  const states = getInitialStateNodes(stateNode);
  for (const initialState of states) {
    for (const ancestor of getProperAncestors(initialState, stateNode)) {
      states.add(ancestor);
    }
  }
  return states;
}
function getInitialStateNodes(stateNode) {
  const set = /* @__PURE__ */ new Set();
  function iter(descStateNode) {
    if (set.has(descStateNode)) {
      return;
    }
    set.add(descStateNode);
    if (descStateNode.type === "compound") {
      iter(descStateNode.initial.target[0]);
    } else if (descStateNode.type === "parallel") {
      for (const child of getChildren(descStateNode)) {
        iter(child);
      }
    }
  }
  iter(stateNode);
  return set;
}
function getStateNode(stateNode, stateKey) {
  if (isStateId(stateKey)) {
    return stateNode.machine.getStateNodeById(stateKey);
  }
  if (!stateNode.states) {
    throw new Error(`Unable to retrieve child state '${stateKey}' from '${stateNode.id}'; no child states exist.`);
  }
  const result = stateNode.states[stateKey];
  if (!result) {
    throw new Error(`Child state '${stateKey}' does not exist on '${stateNode.id}'`);
  }
  return result;
}
function getStateNodeByPath(stateNode, statePath) {
  if (typeof statePath === "string" && isStateId(statePath)) {
    try {
      return stateNode.machine.getStateNodeById(statePath);
    } catch {
    }
  }
  const arrayStatePath = toStatePath(statePath).slice();
  let currentStateNode = stateNode;
  while (arrayStatePath.length) {
    const key = arrayStatePath.shift();
    if (!key.length) {
      break;
    }
    currentStateNode = getStateNode(currentStateNode, key);
  }
  return currentStateNode;
}
function getStateNodes(stateNode, stateValue) {
  if (typeof stateValue === "string") {
    const childStateNode = stateNode.states[stateValue];
    if (!childStateNode) {
      throw new Error(`State '${stateValue}' does not exist on '${stateNode.id}'`);
    }
    return [stateNode, childStateNode];
  }
  const childStateKeys = Object.keys(stateValue);
  const childStateNodes = childStateKeys.map((subStateKey) => getStateNode(stateNode, subStateKey)).filter(Boolean);
  return [stateNode.machine.root, stateNode].concat(childStateNodes, childStateKeys.reduce((allSubStateNodes, subStateKey) => {
    const subStateNode = getStateNode(stateNode, subStateKey);
    if (!subStateNode) {
      return allSubStateNodes;
    }
    const subStateNodes = getStateNodes(subStateNode, stateValue[subStateKey]);
    return allSubStateNodes.concat(subStateNodes);
  }, []));
}
function transitionAtomicNode(stateNode, stateValue, snapshot, event) {
  const childStateNode = getStateNode(stateNode, stateValue);
  const next = childStateNode.next(snapshot, event);
  if (!next || !next.length) {
    return stateNode.next(snapshot, event);
  }
  return next;
}
function transitionCompoundNode(stateNode, stateValue, snapshot, event) {
  const subStateKeys = Object.keys(stateValue);
  const childStateNode = getStateNode(stateNode, subStateKeys[0]);
  const next = transitionNode(childStateNode, stateValue[subStateKeys[0]], snapshot, event);
  if (!next || !next.length) {
    return stateNode.next(snapshot, event);
  }
  return next;
}
function transitionParallelNode(stateNode, stateValue, snapshot, event) {
  const allInnerTransitions = [];
  for (const subStateKey of Object.keys(stateValue)) {
    const subStateValue = stateValue[subStateKey];
    if (!subStateValue) {
      continue;
    }
    const subStateNode = getStateNode(stateNode, subStateKey);
    const innerTransitions = transitionNode(subStateNode, subStateValue, snapshot, event);
    if (innerTransitions) {
      allInnerTransitions.push(...innerTransitions);
    }
  }
  if (!allInnerTransitions.length) {
    return stateNode.next(snapshot, event);
  }
  return allInnerTransitions;
}
function transitionNode(stateNode, stateValue, snapshot, event) {
  if (typeof stateValue === "string") {
    return transitionAtomicNode(stateNode, stateValue, snapshot, event);
  }
  if (Object.keys(stateValue).length === 1) {
    return transitionCompoundNode(stateNode, stateValue, snapshot, event);
  }
  return transitionParallelNode(stateNode, stateValue, snapshot, event);
}
function getHistoryNodes(stateNode) {
  return Object.keys(stateNode.states).map((key) => stateNode.states[key]).filter((sn) => sn.type === "history");
}
function isDescendant(childStateNode, parentStateNode) {
  let marker = childStateNode;
  while (marker.parent && marker.parent !== parentStateNode) {
    marker = marker.parent;
  }
  return marker.parent === parentStateNode;
}
function hasIntersection(s1, s2) {
  const set1 = new Set(s1);
  const set2 = new Set(s2);
  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }
  for (const item of set2) {
    if (set1.has(item)) {
      return true;
    }
  }
  return false;
}
function removeConflictingTransitions(enabledTransitions, stateNodeSet, historyValue) {
  const filteredTransitions = /* @__PURE__ */ new Set();
  for (const t1 of enabledTransitions) {
    let t1Preempted = false;
    const transitionsToRemove = /* @__PURE__ */ new Set();
    for (const t2 of filteredTransitions) {
      if (hasIntersection(computeExitSet([t1], stateNodeSet, historyValue), computeExitSet([t2], stateNodeSet, historyValue))) {
        if (isDescendant(t1.source, t2.source)) {
          transitionsToRemove.add(t2);
        } else {
          t1Preempted = true;
          break;
        }
      }
    }
    if (!t1Preempted) {
      for (const t3 of transitionsToRemove) {
        filteredTransitions.delete(t3);
      }
      filteredTransitions.add(t1);
    }
  }
  return Array.from(filteredTransitions);
}
function findLeastCommonAncestor(stateNodes) {
  const [head, ...tail] = stateNodes;
  for (const ancestor of getProperAncestors(head, void 0)) {
    if (tail.every((sn) => isDescendant(sn, ancestor))) {
      return ancestor;
    }
  }
}
function getEffectiveTargetStates(transition, historyValue) {
  if (!transition.target) {
    return [];
  }
  const targets = /* @__PURE__ */ new Set();
  for (const targetNode of transition.target) {
    if (isHistoryNode(targetNode)) {
      if (historyValue[targetNode.id]) {
        for (const node of historyValue[targetNode.id]) {
          targets.add(node);
        }
      } else {
        for (const node of getEffectiveTargetStates(resolveHistoryDefaultTransition(targetNode), historyValue)) {
          targets.add(node);
        }
      }
    } else {
      targets.add(targetNode);
    }
  }
  return [...targets];
}
function getTransitionDomain(transition, historyValue) {
  const targetStates = getEffectiveTargetStates(transition, historyValue);
  if (!targetStates) {
    return;
  }
  if (!transition.reenter && targetStates.every((target) => target === transition.source || isDescendant(target, transition.source))) {
    return transition.source;
  }
  const lca = findLeastCommonAncestor(targetStates.concat(transition.source));
  if (lca) {
    return lca;
  }
  if (transition.reenter) {
    return;
  }
  return transition.source.machine.root;
}
function computeExitSet(transitions, stateNodeSet, historyValue) {
  const statesToExit = /* @__PURE__ */ new Set();
  for (const t of transitions) {
    if (t.target?.length) {
      const domain = getTransitionDomain(t, historyValue);
      if (t.reenter && t.source === domain) {
        statesToExit.add(domain);
      }
      for (const stateNode of stateNodeSet) {
        if (isDescendant(stateNode, domain)) {
          statesToExit.add(stateNode);
        }
      }
    }
  }
  return [...statesToExit];
}
function areStateNodeCollectionsEqual(prevStateNodes, nextStateNodeSet) {
  if (prevStateNodes.length !== nextStateNodeSet.size) {
    return false;
  }
  for (const node of prevStateNodes) {
    if (!nextStateNodeSet.has(node)) {
      return false;
    }
  }
  return true;
}
function initialMicrostep(root, preInitialState, actorScope, initEvent, internalQueue) {
  return microstep([{
    target: [...getInitialStateNodes(root)],
    source: root,
    reenter: true,
    actions: [],
    eventType: null,
    toJSON: null
  }], preInitialState, actorScope, initEvent, true, internalQueue);
}
function microstep(transitions, currentSnapshot, actorScope, event, isInitial, internalQueue) {
  const actions = [];
  if (!transitions.length) {
    return [currentSnapshot, actions];
  }
  const originalExecutor = actorScope.actionExecutor;
  actorScope.actionExecutor = (action) => {
    actions.push(action);
    originalExecutor(action);
  };
  try {
    const mutStateNodeSet = new Set(currentSnapshot._nodes);
    let historyValue = currentSnapshot.historyValue;
    const filteredTransitions = removeConflictingTransitions(transitions, mutStateNodeSet, historyValue);
    let nextState = currentSnapshot;
    if (!isInitial) {
      [nextState, historyValue] = exitStates(nextState, event, actorScope, filteredTransitions, mutStateNodeSet, historyValue, internalQueue, actorScope.actionExecutor);
    }
    nextState = resolveActionsAndContext(nextState, event, actorScope, filteredTransitions.flatMap((t) => t.actions), internalQueue, void 0);
    nextState = enterStates(nextState, event, actorScope, filteredTransitions, mutStateNodeSet, internalQueue, historyValue, isInitial);
    const nextStateNodes = [...mutStateNodeSet];
    if (nextState.status === "done") {
      nextState = resolveActionsAndContext(nextState, event, actorScope, nextStateNodes.sort((a, b) => b.order - a.order).flatMap((state) => state.exit), internalQueue, void 0);
    }
    try {
      if (historyValue === currentSnapshot.historyValue && areStateNodeCollectionsEqual(currentSnapshot._nodes, mutStateNodeSet)) {
        return [nextState, actions];
      }
      return [cloneMachineSnapshot(nextState, {
        _nodes: nextStateNodes,
        historyValue
      }), actions];
    } catch (e) {
      throw e;
    }
  } finally {
    actorScope.actionExecutor = originalExecutor;
  }
}
function getMachineOutput(snapshot, event, actorScope, rootNode, rootCompletionNode) {
  if (rootNode.output === void 0) {
    return;
  }
  const doneStateEvent = createDoneStateEvent(rootCompletionNode.id, rootCompletionNode.output !== void 0 && rootCompletionNode.parent ? resolveOutput(rootCompletionNode.output, snapshot.context, event, actorScope.self) : void 0);
  return resolveOutput(rootNode.output, snapshot.context, doneStateEvent, actorScope.self);
}
function enterStates(currentSnapshot, event, actorScope, filteredTransitions, mutStateNodeSet, internalQueue, historyValue, isInitial) {
  let nextSnapshot = currentSnapshot;
  const statesToEnter = /* @__PURE__ */ new Set();
  const statesForDefaultEntry = /* @__PURE__ */ new Set();
  computeEntrySet(filteredTransitions, historyValue, statesForDefaultEntry, statesToEnter);
  if (isInitial) {
    statesForDefaultEntry.add(currentSnapshot.machine.root);
  }
  const completedNodes = /* @__PURE__ */ new Set();
  for (const stateNodeToEnter of [...statesToEnter].sort((a, b) => a.order - b.order)) {
    mutStateNodeSet.add(stateNodeToEnter);
    const actions = [];
    actions.push(...stateNodeToEnter.entry);
    for (const invokeDef of stateNodeToEnter.invoke) {
      actions.push(spawnChild(invokeDef.src, {
        ...invokeDef,
        syncSnapshot: !!invokeDef.onSnapshot
      }));
    }
    if (statesForDefaultEntry.has(stateNodeToEnter)) {
      const initialActions = stateNodeToEnter.initial.actions;
      actions.push(...initialActions);
    }
    nextSnapshot = resolveActionsAndContext(nextSnapshot, event, actorScope, actions, internalQueue, stateNodeToEnter.invoke.map((invokeDef) => invokeDef.id));
    if (stateNodeToEnter.type === "final") {
      const parent = stateNodeToEnter.parent;
      let ancestorMarker = parent?.type === "parallel" ? parent : parent?.parent;
      let rootCompletionNode = ancestorMarker || stateNodeToEnter;
      if (parent?.type === "compound") {
        internalQueue.push(createDoneStateEvent(parent.id, stateNodeToEnter.output !== void 0 ? resolveOutput(stateNodeToEnter.output, nextSnapshot.context, event, actorScope.self) : void 0));
      }
      while (ancestorMarker?.type === "parallel" && !completedNodes.has(ancestorMarker) && isInFinalState(mutStateNodeSet, ancestorMarker)) {
        completedNodes.add(ancestorMarker);
        internalQueue.push(createDoneStateEvent(ancestorMarker.id));
        rootCompletionNode = ancestorMarker;
        ancestorMarker = ancestorMarker.parent;
      }
      if (ancestorMarker) {
        continue;
      }
      nextSnapshot = cloneMachineSnapshot(nextSnapshot, {
        status: "done",
        output: getMachineOutput(nextSnapshot, event, actorScope, nextSnapshot.machine.root, rootCompletionNode)
      });
    }
  }
  return nextSnapshot;
}
function computeEntrySet(transitions, historyValue, statesForDefaultEntry, statesToEnter) {
  for (const t of transitions) {
    const domain = getTransitionDomain(t, historyValue);
    for (const s of t.target || []) {
      if (!isHistoryNode(s) && // if the target is different than the source then it will *definitely* be entered
      (t.source !== s || // we know that the domain can't lie within the source
      // if it's different than the source then it's outside of it and it means that the target has to be entered as well
      t.source !== domain || // reentering transitions always enter the target, even if it's the source itself
      t.reenter)) {
        statesToEnter.add(s);
        statesForDefaultEntry.add(s);
      }
      addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
    }
    const targetStates = getEffectiveTargetStates(t, historyValue);
    for (const s of targetStates) {
      const ancestors = getProperAncestors(s, domain);
      if (domain?.type === "parallel") {
        ancestors.push(domain);
      }
      addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, ancestors, !t.source.parent && t.reenter ? void 0 : domain);
    }
  }
}
function addDescendantStatesToEnter(stateNode, historyValue, statesForDefaultEntry, statesToEnter) {
  if (isHistoryNode(stateNode)) {
    if (historyValue[stateNode.id]) {
      const historyStateNodes = historyValue[stateNode.id];
      for (const s of historyStateNodes) {
        statesToEnter.add(s);
        addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
      }
      for (const s of historyStateNodes) {
        addProperAncestorStatesToEnter(s, stateNode.parent, statesToEnter, historyValue, statesForDefaultEntry);
      }
    } else {
      const historyDefaultTransition = resolveHistoryDefaultTransition(stateNode);
      for (const s of historyDefaultTransition.target) {
        statesToEnter.add(s);
        if (historyDefaultTransition === stateNode.parent?.initial) {
          statesForDefaultEntry.add(stateNode.parent);
        }
        addDescendantStatesToEnter(s, historyValue, statesForDefaultEntry, statesToEnter);
      }
      for (const s of historyDefaultTransition.target) {
        addProperAncestorStatesToEnter(s, stateNode.parent, statesToEnter, historyValue, statesForDefaultEntry);
      }
    }
  } else {
    if (stateNode.type === "compound") {
      const [initialState] = stateNode.initial.target;
      if (!isHistoryNode(initialState)) {
        statesToEnter.add(initialState);
        statesForDefaultEntry.add(initialState);
      }
      addDescendantStatesToEnter(initialState, historyValue, statesForDefaultEntry, statesToEnter);
      addProperAncestorStatesToEnter(initialState, stateNode, statesToEnter, historyValue, statesForDefaultEntry);
    } else {
      if (stateNode.type === "parallel") {
        for (const child of getChildren(stateNode).filter((sn) => !isHistoryNode(sn))) {
          if (![...statesToEnter].some((s) => isDescendant(s, child))) {
            if (!isHistoryNode(child)) {
              statesToEnter.add(child);
              statesForDefaultEntry.add(child);
            }
            addDescendantStatesToEnter(child, historyValue, statesForDefaultEntry, statesToEnter);
          }
        }
      }
    }
  }
}
function addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, ancestors, reentrancyDomain) {
  for (const anc of ancestors) {
    if (!reentrancyDomain || isDescendant(anc, reentrancyDomain)) {
      statesToEnter.add(anc);
    }
    if (anc.type === "parallel") {
      for (const child of getChildren(anc).filter((sn) => !isHistoryNode(sn))) {
        if (![...statesToEnter].some((s) => isDescendant(s, child))) {
          statesToEnter.add(child);
          addDescendantStatesToEnter(child, historyValue, statesForDefaultEntry, statesToEnter);
        }
      }
    }
  }
}
function addProperAncestorStatesToEnter(stateNode, toStateNode, statesToEnter, historyValue, statesForDefaultEntry) {
  addAncestorStatesToEnter(statesToEnter, historyValue, statesForDefaultEntry, getProperAncestors(stateNode, toStateNode));
}
function exitStates(currentSnapshot, event, actorScope, transitions, mutStateNodeSet, historyValue, internalQueue, _actionExecutor) {
  let nextSnapshot = currentSnapshot;
  const statesToExit = computeExitSet(transitions, mutStateNodeSet, historyValue);
  statesToExit.sort((a, b) => b.order - a.order);
  let changedHistory;
  for (const exitStateNode of statesToExit) {
    for (const historyNode of getHistoryNodes(exitStateNode)) {
      let predicate;
      if (historyNode.history === "deep") {
        predicate = (sn) => isAtomicStateNode(sn) && isDescendant(sn, exitStateNode);
      } else {
        predicate = (sn) => {
          return sn.parent === exitStateNode;
        };
      }
      changedHistory ??= {
        ...historyValue
      };
      changedHistory[historyNode.id] = Array.from(mutStateNodeSet).filter(predicate);
    }
  }
  for (const s of statesToExit) {
    nextSnapshot = resolveActionsAndContext(nextSnapshot, event, actorScope, [...s.exit, ...s.invoke.map((def) => stopChild(def.id))], internalQueue, void 0);
    mutStateNodeSet.delete(s);
  }
  return [nextSnapshot, changedHistory || historyValue];
}
function getAction(machine, actionType) {
  return machine.implementations.actions[actionType];
}
function resolveAndExecuteActionsWithContext(currentSnapshot, event, actorScope, actions, extra, retries) {
  const {
    machine
  } = currentSnapshot;
  let intermediateSnapshot = currentSnapshot;
  for (const action of actions) {
    const isInline = typeof action === "function";
    const resolvedAction = isInline ? action : (
      // the existing type of `.actions` assumes non-nullable `TExpressionAction`
      // it's fine to cast this here to get a common type and lack of errors in the rest of the code
      // our logic below makes sure that we call those 2 "variants" correctly
      getAction(machine, typeof action === "string" ? action : action.type)
    );
    const actionArgs = {
      context: intermediateSnapshot.context,
      event,
      self: actorScope.self,
      system: actorScope.system
    };
    const actionParams = isInline || typeof action === "string" ? void 0 : "params" in action ? typeof action.params === "function" ? action.params({
      context: intermediateSnapshot.context,
      event
    }) : action.params : void 0;
    if (!resolvedAction || !("resolve" in resolvedAction)) {
      actorScope.actionExecutor({
        type: typeof action === "string" ? action : typeof action === "object" ? action.type : action.name || "(anonymous)",
        info: actionArgs,
        params: actionParams,
        exec: resolvedAction
      });
      continue;
    }
    const builtinAction = resolvedAction;
    const [nextState, params, actions2] = builtinAction.resolve(
      actorScope,
      intermediateSnapshot,
      actionArgs,
      actionParams,
      resolvedAction,
      // this holds all params
      extra
    );
    intermediateSnapshot = nextState;
    if ("retryResolve" in builtinAction) {
      retries?.push([builtinAction, params]);
    }
    if ("execute" in builtinAction) {
      actorScope.actionExecutor({
        type: builtinAction.type,
        info: actionArgs,
        params,
        exec: builtinAction.execute.bind(null, actorScope, params)
      });
    }
    if (actions2) {
      intermediateSnapshot = resolveAndExecuteActionsWithContext(intermediateSnapshot, event, actorScope, actions2, extra, retries);
    }
  }
  return intermediateSnapshot;
}
function resolveActionsAndContext(currentSnapshot, event, actorScope, actions, internalQueue, deferredActorIds) {
  const retries = deferredActorIds ? [] : void 0;
  const nextState = resolveAndExecuteActionsWithContext(currentSnapshot, event, actorScope, actions, {
    internalQueue,
    deferredActorIds
  }, retries);
  retries?.forEach(([builtinAction, params]) => {
    builtinAction.retryResolve(actorScope, nextState, params);
  });
  return nextState;
}
function macrostep(snapshot, event, actorScope, internalQueue) {
  let nextSnapshot = snapshot;
  const microsteps = [];
  function addMicrostep(step, event2, transitions) {
    actorScope.system._sendInspectionEvent({
      type: "@xstate.microstep",
      actorRef: actorScope.self,
      event: event2,
      snapshot: step[0],
      _transitions: transitions
    });
    microsteps.push(step);
  }
  if (event.type === XSTATE_STOP) {
    nextSnapshot = cloneMachineSnapshot(stopChildren(nextSnapshot, event, actorScope), {
      status: "stopped"
    });
    addMicrostep([nextSnapshot, []], event, []);
    return {
      snapshot: nextSnapshot,
      microsteps
    };
  }
  let nextEvent = event;
  if (nextEvent.type !== XSTATE_INIT) {
    const currentEvent = nextEvent;
    const isErr = isErrorActorEvent(currentEvent);
    const transitions = selectTransitions(currentEvent, nextSnapshot);
    if (isErr && !transitions.length) {
      nextSnapshot = cloneMachineSnapshot(snapshot, {
        status: "error",
        error: currentEvent.error
      });
      addMicrostep([nextSnapshot, []], currentEvent, []);
      return {
        snapshot: nextSnapshot,
        microsteps
      };
    }
    const step = microstep(
      transitions,
      snapshot,
      actorScope,
      nextEvent,
      false,
      // isInitial
      internalQueue
    );
    nextSnapshot = step[0];
    addMicrostep(step, currentEvent, transitions);
  }
  let shouldSelectEventlessTransitions = true;
  while (nextSnapshot.status === "active") {
    let enabledTransitions = shouldSelectEventlessTransitions ? selectEventlessTransitions(nextSnapshot, nextEvent) : [];
    const previousState = enabledTransitions.length ? nextSnapshot : void 0;
    if (!enabledTransitions.length) {
      if (!internalQueue.length) {
        break;
      }
      nextEvent = internalQueue.shift();
      enabledTransitions = selectTransitions(nextEvent, nextSnapshot);
    }
    const step = microstep(enabledTransitions, nextSnapshot, actorScope, nextEvent, false, internalQueue);
    nextSnapshot = step[0];
    shouldSelectEventlessTransitions = nextSnapshot !== previousState;
    addMicrostep(step, nextEvent, enabledTransitions);
  }
  if (nextSnapshot.status !== "active") {
    stopChildren(nextSnapshot, nextEvent, actorScope);
  }
  return {
    snapshot: nextSnapshot,
    microsteps
  };
}
function stopChildren(nextState, event, actorScope) {
  return resolveActionsAndContext(nextState, event, actorScope, Object.values(nextState.children).map((child) => stopChild(child)), [], void 0);
}
function selectTransitions(event, nextState) {
  return nextState.machine.getTransitionData(nextState, event);
}
function selectEventlessTransitions(nextState, event) {
  const enabledTransitionSet = /* @__PURE__ */ new Set();
  const atomicStates = nextState._nodes.filter(isAtomicStateNode);
  for (const stateNode of atomicStates) {
    loop: for (const s of [stateNode].concat(getProperAncestors(stateNode, void 0))) {
      if (!s.always) {
        continue;
      }
      for (const transition of s.always) {
        if (transition.guard === void 0 || evaluateGuard(transition.guard, nextState.context, event, nextState)) {
          enabledTransitionSet.add(transition);
          break loop;
        }
      }
    }
  }
  return removeConflictingTransitions(Array.from(enabledTransitionSet), new Set(nextState._nodes), nextState.historyValue);
}
function resolveStateValue(rootNode, stateValue) {
  const allStateNodes = getAllStateNodes(getStateNodes(rootNode, stateValue));
  return getStateValue(rootNode, [...allStateNodes]);
}
function isMachineSnapshot(value) {
  return !!value && typeof value === "object" && "machine" in value && "value" in value;
}
var machineSnapshotMatches = function matches(testValue) {
  return matchesState(testValue, this.value);
};
var machineSnapshotHasTag = function hasTag(tag) {
  return this.tags.has(tag);
};
var machineSnapshotCan = function can(event) {
  const transitionData = this.machine.getTransitionData(this, event);
  return !!transitionData?.length && // Check that at least one transition is not forbidden
  transitionData.some((t) => t.target !== void 0 || t.actions.length);
};
var machineSnapshotToJSON = function toJSON() {
  const {
    _nodes: nodes,
    tags,
    machine,
    getMeta: getMeta2,
    toJSON: toJSON2,
    can: can2,
    hasTag: hasTag2,
    matches: matches2,
    ...jsonValues
  } = this;
  return {
    ...jsonValues,
    tags: Array.from(tags)
  };
};
var machineSnapshotGetMeta = function getMeta() {
  return this._nodes.reduce((acc, stateNode) => {
    if (stateNode.meta !== void 0) {
      acc[stateNode.id] = stateNode.meta;
    }
    return acc;
  }, {});
};
function createMachineSnapshot(config, machine) {
  return {
    status: config.status,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    _nodes: config._nodes,
    value: getStateValue(machine.root, config._nodes),
    tags: new Set(config._nodes.flatMap((sn) => sn.tags)),
    children: config.children,
    historyValue: config.historyValue || {},
    matches: machineSnapshotMatches,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    toJSON: machineSnapshotToJSON
  };
}
function cloneMachineSnapshot(snapshot, config = {}) {
  return createMachineSnapshot({
    ...snapshot,
    ...config
  }, snapshot.machine);
}
function serializeHistoryValue(historyValue) {
  if (typeof historyValue !== "object" || historyValue === null) {
    return {};
  }
  const result = {};
  for (const key in historyValue) {
    const value = historyValue[key];
    if (Array.isArray(value)) {
      result[key] = value.map((item) => ({
        id: item.id
      }));
    }
  }
  return result;
}
function getPersistedSnapshot(snapshot, options) {
  const {
    _nodes: nodes,
    tags,
    machine,
    children,
    context,
    can: can2,
    hasTag: hasTag2,
    matches: matches2,
    getMeta: getMeta2,
    toJSON: toJSON2,
    ...jsonValues
  } = snapshot;
  const childrenJson = {};
  for (const id in children) {
    const child = children[id];
    childrenJson[id] = {
      snapshot: child.getPersistedSnapshot(options),
      src: child.src,
      systemId: child.systemId,
      syncSnapshot: child._syncSnapshot
    };
  }
  const persisted = {
    ...jsonValues,
    context: persistContext(context),
    children: childrenJson,
    historyValue: serializeHistoryValue(jsonValues.historyValue)
  };
  return persisted;
}
function persistContext(contextPart) {
  let copy;
  for (const key in contextPart) {
    const value = contextPart[key];
    if (value && typeof value === "object") {
      if ("sessionId" in value && "send" in value && "ref" in value) {
        copy ??= Array.isArray(contextPart) ? contextPart.slice() : {
          ...contextPart
        };
        copy[key] = {
          xstate$$type: $$ACTOR_TYPE,
          id: value.id
        };
      } else {
        const result = persistContext(value);
        if (result !== value) {
          copy ??= Array.isArray(contextPart) ? contextPart.slice() : {
            ...contextPart
          };
          copy[key] = result;
        }
      }
    }
  }
  return copy ?? contextPart;
}
function resolveRaise(_, snapshot, args, actionParams, {
  event: eventOrExpr,
  id,
  delay
}, {
  internalQueue
}) {
  const delaysMap = snapshot.machine.implementations.delays;
  if (typeof eventOrExpr === "string") {
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Only event objects may be used with raise; use raise({ type: "${eventOrExpr}" }) instead`
    );
  }
  const resolvedEvent = typeof eventOrExpr === "function" ? eventOrExpr(args, actionParams) : eventOrExpr;
  let resolvedDelay;
  if (typeof delay === "string") {
    const configDelay = delaysMap && delaysMap[delay];
    resolvedDelay = typeof configDelay === "function" ? configDelay(args, actionParams) : configDelay;
  } else {
    resolvedDelay = typeof delay === "function" ? delay(args, actionParams) : delay;
  }
  if (typeof resolvedDelay !== "number") {
    internalQueue.push(resolvedEvent);
  }
  return [snapshot, {
    event: resolvedEvent,
    id,
    delay: resolvedDelay
  }, void 0];
}
function executeRaise(actorScope, params) {
  const {
    event,
    delay,
    id
  } = params;
  if (typeof delay === "number") {
    actorScope.defer(() => {
      const self2 = actorScope.self;
      actorScope.system.scheduler.schedule(self2, self2, event, delay, id);
    });
    return;
  }
}
function raise(eventOrExpr, options) {
  function raise2(_args, _params) {
  }
  raise2.type = "xstate.raise";
  raise2.event = eventOrExpr;
  raise2.id = options?.id;
  raise2.delay = options?.delay;
  raise2.resolve = resolveRaise;
  raise2.execute = executeRaise;
  return raise2;
}

// node_modules/xstate/actors/dist/xstate-actors.esm.js
function fromTransition(transition, initialContext) {
  return {
    config: transition,
    transition: (snapshot, event, actorScope) => {
      return {
        ...snapshot,
        context: transition(snapshot.context, event, actorScope)
      };
    },
    getInitialSnapshot: (_, input) => {
      return {
        status: "active",
        output: void 0,
        error: void 0,
        context: typeof initialContext === "function" ? initialContext({
          input
        }) : initialContext
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot) => snapshot
  };
}
var emptyLogic = fromTransition((_) => void 0, void 0);

// node_modules/xstate/dist/assign-5f7ff891.esm.js
function createSpawner(actorScope, {
  machine,
  context
}, event, spawnedChildren) {
  const spawn = (src, options) => {
    if (typeof src === "string") {
      const logic = resolveReferencedActor(machine, src);
      if (!logic) {
        throw new Error(`Actor logic '${src}' not implemented in machine '${machine.id}'`);
      }
      const actorRef = createActor(logic, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input: typeof options?.input === "function" ? options.input({
          context,
          event,
          self: actorScope.self
        }) : options?.input,
        src,
        systemId: options?.systemId
      });
      spawnedChildren[actorRef.id] = actorRef;
      return actorRef;
    } else {
      const actorRef = createActor(src, {
        id: options?.id,
        parent: actorScope.self,
        syncSnapshot: options?.syncSnapshot,
        input: options?.input,
        src,
        systemId: options?.systemId
      });
      return actorRef;
    }
  };
  return (src, options) => {
    const actorRef = spawn(src, options);
    spawnedChildren[actorRef.id] = actorRef;
    actorScope.defer(() => {
      if (actorRef._processingStatus === ProcessingStatus.Stopped) {
        return;
      }
      actorRef.start();
    });
    return actorRef;
  };
}
function resolveAssign(actorScope, snapshot, actionArgs, actionParams, {
  assignment
}) {
  if (!snapshot.context) {
    throw new Error("Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.");
  }
  const spawnedChildren = {};
  const assignArgs = {
    context: snapshot.context,
    event: actionArgs.event,
    spawn: createSpawner(actorScope, snapshot, actionArgs.event, spawnedChildren),
    self: actorScope.self,
    system: actorScope.system
  };
  let partialUpdate = {};
  if (typeof assignment === "function") {
    partialUpdate = assignment(assignArgs, actionParams);
  } else {
    for (const key of Object.keys(assignment)) {
      const propAssignment = assignment[key];
      partialUpdate[key] = typeof propAssignment === "function" ? propAssignment(assignArgs, actionParams) : propAssignment;
    }
  }
  const updatedContext = Object.assign({}, snapshot.context, partialUpdate);
  return [cloneMachineSnapshot(snapshot, {
    context: updatedContext,
    children: Object.keys(spawnedChildren).length ? {
      ...snapshot.children,
      ...spawnedChildren
    } : snapshot.children
  }), void 0, void 0];
}
function assign(assignment) {
  function assign2(_args, _params) {
  }
  assign2.type = "xstate.assign";
  assign2.assignment = assignment;
  assign2.resolve = resolveAssign;
  return assign2;
}

// node_modules/xstate/dist/StateMachine-9ef88566.esm.js
var cache = /* @__PURE__ */ new WeakMap();
function memo(object, key, fn) {
  let memoizedData = cache.get(object);
  if (!memoizedData) {
    memoizedData = {
      [key]: fn()
    };
    cache.set(object, memoizedData);
  } else if (!(key in memoizedData)) {
    memoizedData[key] = fn();
  }
  return memoizedData[key];
}
var EMPTY_OBJECT = {};
var toSerializableAction = (action) => {
  if (typeof action === "string") {
    return {
      type: action
    };
  }
  if (typeof action === "function") {
    if ("resolve" in action) {
      return {
        type: action.type
      };
    }
    return {
      type: action.name
    };
  }
  return action;
};
var StateNode = class _StateNode {
  constructor(config, options) {
    this.config = config;
    this.key = void 0;
    this.id = void 0;
    this.type = void 0;
    this.path = void 0;
    this.states = void 0;
    this.history = void 0;
    this.entry = void 0;
    this.exit = void 0;
    this.parent = void 0;
    this.machine = void 0;
    this.meta = void 0;
    this.output = void 0;
    this.order = -1;
    this.description = void 0;
    this.tags = [];
    this.transitions = void 0;
    this.always = void 0;
    this.parent = options._parent;
    this.key = options._key;
    this.machine = options._machine;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.id = this.config.id || [this.machine.id, ...this.path].join(STATE_DELIMITER);
    this.type = this.config.type || (this.config.states && Object.keys(this.config.states).length ? "compound" : this.config.history ? "history" : "atomic");
    this.description = this.config.description;
    this.order = this.machine.idMap.size;
    this.machine.idMap.set(this.id, this);
    this.states = this.config.states ? mapValues(this.config.states, (stateConfig, key) => {
      const stateNode = new _StateNode(stateConfig, {
        _parent: this,
        _key: key,
        _machine: this.machine
      });
      return stateNode;
    }) : EMPTY_OBJECT;
    if (this.type === "compound" && !this.config.initial) {
      throw new Error(`No initial state specified for compound state node "#${this.id}". Try adding { initial: "${Object.keys(this.states)[0]}" } to the state config.`);
    }
    this.history = this.config.history === true ? "shallow" : this.config.history || false;
    this.entry = toArray(this.config.entry).slice();
    this.exit = toArray(this.config.exit).slice();
    this.meta = this.config.meta;
    this.output = this.type === "final" || !this.parent ? this.config.output : void 0;
    this.tags = toArray(config.tags).slice();
  }
  /** @internal */
  _initialize() {
    this.transitions = formatTransitions(this);
    if (this.config.always) {
      this.always = toTransitionConfigArray(this.config.always).map((t) => formatTransition(this, NULL_EVENT, t));
    }
    Object.keys(this.states).forEach((key) => {
      this.states[key]._initialize();
    });
  }
  /** The well-structured state node definition. */
  get definition() {
    return {
      id: this.id,
      key: this.key,
      version: this.machine.version,
      type: this.type,
      initial: this.initial ? {
        target: this.initial.target,
        source: this,
        actions: this.initial.actions.map(toSerializableAction),
        eventType: null,
        reenter: false,
        toJSON: () => ({
          target: this.initial.target.map((t) => `#${t.id}`),
          source: `#${this.id}`,
          actions: this.initial.actions.map(toSerializableAction),
          eventType: null
        })
      } : void 0,
      history: this.history,
      states: mapValues(this.states, (state) => {
        return state.definition;
      }),
      on: this.on,
      transitions: [...this.transitions.values()].flat().map((t) => ({
        ...t,
        actions: t.actions.map(toSerializableAction)
      })),
      entry: this.entry.map(toSerializableAction),
      exit: this.exit.map(toSerializableAction),
      meta: this.meta,
      order: this.order || -1,
      output: this.output,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags
    };
  }
  /** @internal */
  toJSON() {
    return this.definition;
  }
  /** The logic invoked as actors by this state node. */
  get invoke() {
    return memo(this, "invoke", () => toArray(this.config.invoke).map((invokeConfig, i) => {
      const {
        src,
        systemId
      } = invokeConfig;
      const resolvedId = invokeConfig.id ?? createInvokeId(this.id, i);
      const sourceName = typeof src === "string" ? src : `xstate.invoke.${createInvokeId(this.id, i)}`;
      return {
        ...invokeConfig,
        src: sourceName,
        id: resolvedId,
        systemId,
        toJSON() {
          const {
            onDone,
            onError,
            ...invokeDefValues
          } = invokeConfig;
          return {
            ...invokeDefValues,
            type: "xstate.invoke",
            src: sourceName,
            id: resolvedId
          };
        }
      };
    }));
  }
  /** The mapping of events to transitions. */
  get on() {
    return memo(this, "on", () => {
      const transitions = this.transitions;
      return [...transitions].flatMap(([descriptor, t]) => t.map((t2) => [descriptor, t2])).reduce((map, [descriptor, transition]) => {
        map[descriptor] = map[descriptor] || [];
        map[descriptor].push(transition);
        return map;
      }, {});
    });
  }
  get after() {
    return memo(this, "delayedTransitions", () => getDelayedTransitions(this));
  }
  get initial() {
    return memo(this, "initial", () => formatInitialTransition(this, this.config.initial));
  }
  /** @internal */
  next(snapshot, event) {
    const eventType = event.type;
    const actions = [];
    let selectedTransition;
    const candidates = memo(this, `candidates-${eventType}`, () => getCandidates(this, eventType));
    for (const candidate of candidates) {
      const {
        guard
      } = candidate;
      const resolvedContext = snapshot.context;
      let guardPassed = false;
      try {
        guardPassed = !guard || evaluateGuard(guard, resolvedContext, event, snapshot);
      } catch (err) {
        const guardType = typeof guard === "string" ? guard : typeof guard === "object" ? guard.type : void 0;
        throw new Error(`Unable to evaluate guard ${guardType ? `'${guardType}' ` : ""}in transition for event '${eventType}' in state node '${this.id}':
${err.message}`);
      }
      if (guardPassed) {
        actions.push(...candidate.actions);
        selectedTransition = candidate;
        break;
      }
    }
    return selectedTransition ? [selectedTransition] : void 0;
  }
  /** All the event types accepted by this state node and its descendants. */
  get events() {
    return memo(this, "events", () => {
      const {
        states
      } = this;
      const events = new Set(this.ownEvents);
      if (states) {
        for (const stateId of Object.keys(states)) {
          const state = states[stateId];
          if (state.states) {
            for (const event of state.events) {
              events.add(`${event}`);
            }
          }
        }
      }
      return Array.from(events);
    });
  }
  /**
   * All the events that have transitions directly from this state node.
   *
   * Excludes any inert events.
   */
  get ownEvents() {
    const keys = Object.keys(Object.fromEntries(this.transitions));
    const events = new Set(keys.filter((descriptor) => {
      return this.transitions.get(descriptor).some((transition) => !(!transition.target && !transition.actions.length && !transition.reenter));
    }));
    return Array.from(events);
  }
};
var STATE_IDENTIFIER2 = "#";
var StateMachine = class _StateMachine {
  constructor(config, implementations) {
    this.config = config;
    this.version = void 0;
    this.schemas = void 0;
    this.implementations = void 0;
    this.__xstatenode = true;
    this.idMap = /* @__PURE__ */ new Map();
    this.root = void 0;
    this.id = void 0;
    this.states = void 0;
    this.events = void 0;
    this.id = config.id || "(machine)";
    this.implementations = {
      actors: implementations?.actors ?? {},
      actions: implementations?.actions ?? {},
      delays: implementations?.delays ?? {},
      guards: implementations?.guards ?? {}
    };
    this.version = this.config.version;
    this.schemas = this.config.schemas;
    this.transition = this.transition.bind(this);
    this.getInitialSnapshot = this.getInitialSnapshot.bind(this);
    this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this);
    this.restoreSnapshot = this.restoreSnapshot.bind(this);
    this.start = this.start.bind(this);
    this.root = new StateNode(config, {
      _key: this.id,
      _machine: this
    });
    this.root._initialize();
    formatRouteTransitions(this.root);
    this.states = this.root.states;
    this.events = this.root.events;
  }
  /**
   * Clones this state machine with the provided implementations.
   *
   * @param implementations Options (`actions`, `guards`, `actors`, `delays`) to
   *   recursively merge with the existing options.
   * @returns A new `StateMachine` instance with the provided implementations.
   */
  provide(implementations) {
    const {
      actions,
      guards,
      actors,
      delays
    } = this.implementations;
    return new _StateMachine(this.config, {
      actions: {
        ...actions,
        ...implementations.actions
      },
      guards: {
        ...guards,
        ...implementations.guards
      },
      actors: {
        ...actors,
        ...implementations.actors
      },
      delays: {
        ...delays,
        ...implementations.delays
      }
    });
  }
  resolveState(config) {
    const resolvedStateValue = resolveStateValue(this.root, config.value);
    const nodeSet = getAllStateNodes(getStateNodes(this.root, resolvedStateValue));
    return createMachineSnapshot({
      _nodes: [...nodeSet],
      context: config.context || {},
      children: {},
      status: isInFinalState(nodeSet, this.root) ? "done" : config.status || "active",
      output: config.output,
      error: config.error,
      historyValue: config.historyValue
    }, this);
  }
  /**
   * Determines the next snapshot given the current `snapshot` and received
   * `event`. Calculates a full macrostep from all microsteps.
   *
   * @param snapshot The current snapshot
   * @param event The received event
   */
  transition(snapshot, event, actorScope) {
    return macrostep(snapshot, event, actorScope, []).snapshot;
  }
  /**
   * Determines the next state given the current `state` and `event`. Calculates
   * a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  microstep(snapshot, event, actorScope) {
    return macrostep(snapshot, event, actorScope, []).microsteps.map(([s]) => s);
  }
  getTransitionData(snapshot, event) {
    return transitionNode(this.root, snapshot.value, snapshot, event) || [];
  }
  /**
   * The initial state _before_ evaluating any microsteps. This "pre-initial"
   * state is provided to initial actions executed in the initial state.
   *
   * @internal
   */
  _getPreInitialState(actorScope, initEvent, internalQueue) {
    const {
      context
    } = this.config;
    const preInitial = createMachineSnapshot({
      context: typeof context !== "function" && context ? context : {},
      _nodes: [this.root],
      children: {},
      status: "active"
    }, this);
    if (typeof context === "function") {
      const assignment = ({
        spawn,
        event,
        self: self2
      }) => context({
        spawn,
        input: event.input,
        self: self2
      });
      return resolveActionsAndContext(preInitial, initEvent, actorScope, [assign(assignment)], internalQueue, void 0);
    }
    return preInitial;
  }
  /**
   * Returns the initial `State` instance, with reference to `self` as an
   * `ActorRef`.
   */
  getInitialSnapshot(actorScope, input) {
    const initEvent = createInitEvent(input);
    const internalQueue = [];
    const preInitialState = this._getPreInitialState(actorScope, initEvent, internalQueue);
    const [nextState] = initialMicrostep(this.root, preInitialState, actorScope, initEvent, internalQueue);
    const {
      snapshot: macroState
    } = macrostep(nextState, initEvent, actorScope, internalQueue);
    return macroState;
  }
  start(snapshot) {
    Object.values(snapshot.children).forEach((child) => {
      if (child.getSnapshot().status === "active") {
        child.start();
      }
    });
  }
  getStateNodeById(stateId) {
    const fullPath = toStatePath(stateId);
    const relativePath = fullPath.slice(1);
    const resolvedStateId = isStateId(fullPath[0]) ? fullPath[0].slice(STATE_IDENTIFIER2.length) : fullPath[0];
    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(`Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`);
    }
    return getStateNodeByPath(stateNode, relativePath);
  }
  get definition() {
    return this.root.definition;
  }
  toJSON() {
    return this.definition;
  }
  getPersistedSnapshot(snapshot, options) {
    return getPersistedSnapshot(snapshot, options);
  }
  restoreSnapshot(snapshot, _actorScope) {
    const children = {};
    const snapshotChildren = snapshot.children;
    Object.keys(snapshotChildren).forEach((actorId) => {
      const actorData = snapshotChildren[actorId];
      const childState = actorData.snapshot;
      const src = actorData.src;
      const logic = typeof src === "string" ? resolveReferencedActor(this, src) : src;
      if (!logic) {
        return;
      }
      const actorRef = createActor(logic, {
        id: actorId,
        parent: _actorScope.self,
        syncSnapshot: actorData.syncSnapshot,
        snapshot: childState,
        src,
        systemId: actorData.systemId
      });
      children[actorId] = actorRef;
    });
    function resolveHistoryReferencedState(root, referenced) {
      if (referenced instanceof StateNode) {
        return referenced;
      }
      try {
        return root.machine.getStateNodeById(referenced.id);
      } catch {
      }
    }
    function reviveHistoryValue(root, historyValue) {
      if (!historyValue || typeof historyValue !== "object") {
        return {};
      }
      const revived = {};
      for (const key in historyValue) {
        const arr = historyValue[key];
        for (const item of arr) {
          const resolved = resolveHistoryReferencedState(root, item);
          if (!resolved) {
            continue;
          }
          revived[key] ??= [];
          revived[key].push(resolved);
        }
      }
      return revived;
    }
    const revivedHistoryValue = reviveHistoryValue(this.root, snapshot.historyValue);
    const restoredSnapshot = createMachineSnapshot({
      ...snapshot,
      children,
      _nodes: Array.from(getAllStateNodes(getStateNodes(this.root, snapshot.value))),
      historyValue: revivedHistoryValue
    }, this);
    const seen = /* @__PURE__ */ new Set();
    function reviveContext(contextPart, children2) {
      if (seen.has(contextPart)) {
        return;
      }
      seen.add(contextPart);
      for (const key in contextPart) {
        const value = contextPart[key];
        if (value && typeof value === "object") {
          if ("xstate$$type" in value && value.xstate$$type === $$ACTOR_TYPE) {
            contextPart[key] = children2[value.id];
            continue;
          }
          reviveContext(value, children2);
        }
      }
    }
    reviveContext(restoredSnapshot.context, children);
    return restoredSnapshot;
  }
};

// node_modules/xstate/dist/xstate.esm.js
function createMachine(config, implementations) {
  return new StateMachine(config, implementations);
}

// src/server/games/SigilGartic/StateMachine.ts
var garticMachine = createMachine({
  types: {},
  id: "sigilGartic",
  initial: "LOBBY",
  context: ({ input }) => ({
    roomId: input.roomId ?? "",
    players: /* @__PURE__ */ new Map(),
    currentRound: 0,
    maxRounds: input.maxRounds ?? 3,
    currentDrawerIndex: 0,
    currentWord: null,
    submissions: /* @__PURE__ */ new Map(),
    scores: /* @__PURE__ */ new Map(),
    timer: 0,
    mode: input.mode ?? "NORMAL",
    album: []
  }),
  states: {
    LOBBY: {
      on: {
        START_GAME: {
          target: "BRIEFING",
          // guard: ({ context }) => context.players.size >= 2,
          actions: assign({ currentRound: 0 })
        }
      }
    },
    BRIEFING: {
      entry: assign(({ context }) => ({
        currentWord: { label: "Test", category: "Test" },
        // To be replaced with pickWord
        submissions: /* @__PURE__ */ new Map(),
        timer: 3
      })),
      after: { 3e3: "DRAWING" }
    },
    DRAWING: {
      entry: assign(({ context }) => ({
        timer: context.mode === "NORMAL" ? 60 : 120
      })),
      on: {
        DRAWING_DONE: {
          target: "GUESSING"
          // guard: ({ context, event }) => event.playerId === getCurrentDrawer(context),
        },
        TIMER_END: "GUESSING"
      },
      after: {
        6e4: "GUESSING"
      }
    },
    GUESSING: {
      entry: assign({ timer: 45 }),
      on: {
        SUBMIT_GUESS: {
          actions: assign({
            submissions: ({ context, event }) => {
              const newSubmap = new Map(context.submissions);
              newSubmap.set(event.playerId, {
                type: "text",
                content: event.guess,
                timestamp: Date.now(),
                timeRemainingRatio: 1
              });
              return newSubmap;
            }
          })
        },
        ALL_SUBMITTED: "INTERMISSION",
        TIMER_END: "INTERMISSION"
      }
    },
    INTERMISSION: {
      entry: assign(({ context }) => ({
        // scores: computeScores(context),
        // album: updateAlbum(context),
      })),
      after: {
        5e3: [
          {
            target: "BRIEFING",
            guard: ({ context }) => context.currentRound < context.maxRounds - 1,
            actions: assign({
              currentRound: ({ context }) => context.currentRound + 1,
              currentDrawerIndex: ({ context }) => (context.currentDrawerIndex + 1) % context.players.size
            })
          },
          { target: "REVEAL" }
        ]
      }
    },
    REVEAL: {
      on: {
        NEXT_PLAYER_ALBUM: {
          // Navigation dans les albums
        },
        END_REVEAL: "SCORES"
      }
    },
    SCORES: {
      after: { 1e4: "LOBBY" },
      on: { PLAY_AGAIN: "LOBBY" }
    }
  }
});

// src/server/games/SigilGartic/Room.ts
var GarticRoom = class {
  constructor(io2, config) {
    this.strokeHistory = [];
    this.timers = /* @__PURE__ */ new Map();
    this.io = io2;
    this.machine = createActor(garticMachine, {
      input: { roomId: config.id, ...config }
    });
    this.machine.start();
    this.machine.subscribe(this.onStateChange.bind(this));
  }
  onStateChange(snapshot) {
    const snap = snapshot;
    const phase = snap.value;
    this.state = snap.context;
    this.io.to(this.state.roomId).emit("gartic:state:update", {
      phase,
      players: Array.from(this.state.players.values()),
      currentRound: snap.context.currentRound,
      maxRounds: snap.context.maxRounds,
      drawerName: "Drawer",
      // to fix
      timer: snap.context.timer,
      scores: Object.fromEntries(snap.context.scores)
    });
    switch (phase) {
      case "BRIEFING":
        this.handleBriefing(snap.context);
        break;
      case "DRAWING":
        this.strokeHistory = [];
        this.startCountdown(snap.context.timer, "DRAWING");
        break;
      case "GUESSING":
        this.startCountdown(45, "GUESSING");
        break;
      case "REVEAL":
        this.sendAlbums(snap.context);
        break;
    }
  }
  addPlayer(socket) {
    const user = socket.data?.user;
    if (!user) return;
    this.state.players.set(socket.id, {
      id: socket.id,
      username: user.name || "Unknown",
      dofusClass: "1",
      isReady: false,
      score: 0
    });
  }
  handlePlayerDisconnect(socketId, reason) {
    this.state.players.delete(socketId);
  }
  isEmpty() {
    return this.state.players.size === 0;
  }
  destroy() {
    this.timers.forEach((t) => clearInterval(t));
    this.machine.stop();
  }
  handleBriefing(ctx) {
  }
  async sendAlbums(ctx) {
    const albumData = ctx.album;
    const cacheKey = `gartic:album:${ctx.roomId}`;
    await redis.set(cacheKey, JSON.stringify(albumData), "EX", 3600);
    this.io.to(ctx.roomId).emit("gartic:album:ready", {
      roomId: ctx.roomId,
      expiresIn: 3600
    });
  }
  handleStroke(socket, stroke) {
    if (this.machine.getSnapshot().value !== "DRAWING") return;
    this.strokeHistory.push(stroke);
    socket.to(this.state.roomId).emit("gartic:draw:stroke", stroke);
  }
  handleGuess(socket, text) {
    if (this.machine.getSnapshot().value !== "GUESSING") return;
    this.machine.send({ type: "SUBMIT_GUESS", playerId: socket.id, guess: text });
  }
  handleLateJoin(socket) {
    if (this.strokeHistory.length > 0) {
      socket.emit("gartic:draw:history", this.strokeHistory);
    }
  }
  startCountdown(duration, phase) {
    const key = `timer_${phase}`;
    if (this.timers.has(key)) clearInterval(this.timers.get(key));
    let remaining = duration;
    const interval = setInterval(() => {
      remaining--;
      this.io.to(this.state.roomId).emit("gartic:timer:tick", { remaining });
      if (remaining <= 0) {
        clearInterval(interval);
        this.machine.send({ type: "TIMER_END" });
      }
    }, 1e3);
    this.timers.set(key, interval);
  }
};

// src/server/games/SigilGartic/GameManager.ts
function generateShortId() {
  return "DOFUS-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}
var GameManager = class {
  constructor(io2) {
    this.io = io2;
    // We KEEP the room objects in-memory for active instances, 
    // but the INDEX (socketId -> roomId) goes to Redis for better horizontal scalability/resilience.
    this.rooms = /* @__PURE__ */ new Map();
  }
  registerSocket(socket) {
    socket.on("gartic:room:create", (config) => this.createRoom(socket, config));
    socket.on("gartic:room:join", ({ roomId }) => this.joinRoom(socket, roomId));
    socket.on("gartic:draw:stroke", (stroke) => this.relayStroke(socket, stroke));
    socket.on("gartic:draw:clear", () => this.relayAction(socket, "clear"));
    socket.on("gartic:draw:undo", () => this.relayAction(socket, "undo"));
    socket.on("gartic:guess:submit", ({ text }) => this.handleGuess(socket, text));
  }
  async setSocketRoom(socketId, roomId) {
    await redis.set(`socket:${socketId}:room`, roomId, "EX", 3600);
  }
  async getSocketRoom(socketId) {
    return await redis.get(`socket:${socketId}:room`);
  }
  async delSocketRoom(socketId) {
    await redis.del(`socket:${socketId}:room`);
  }
  async createRoom(socket, config) {
    const roomId = generateShortId();
    const room = new GarticRoom(this.io, { ...config, id: roomId });
    this.rooms.set(roomId, room);
    socket.join(roomId);
    await this.setSocketRoom(socket.id, roomId);
    room.addPlayer(socket);
    socket.emit("gartic:room:created", { roomId });
  }
  async joinRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    socket.join(roomId);
    await this.setSocketRoom(socket.id, roomId);
    room.addPlayer(socket);
    room.handleLateJoin(socket);
  }
  async relayStroke(socket, stroke) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.handleStroke(socket, stroke);
  }
  async relayAction(socket, action) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit(`gartic:draw:${action}`);
  }
  async handleGuess(socket, text) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.handleGuess(socket, text);
  }
  async handleDisconnect(socket, reason) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.handlePlayerDisconnect(socket.id, reason);
    await this.delSocketRoom(socket.id);
    if (room.isEmpty()) {
      room.destroy();
      this.rooms.delete(roomId);
    }
  }
};

// src/server/games/SigilSkribbl/words.ts
var getDofusWords = (count = 3) => {
  const words = [
    "Bouftou",
    "Tofu",
    "Piou",
    "Goultard",
    "Dofus Ocre",
    "Dofus Pourpre",
    "Dofus Emeraude",
    "Dofus Turquoise",
    "Cra",
    "Iop",
    "Ecaflip",
    "Eniripsa",
    "Sadida",
    "Zobal",
    "Roublard",
    "Steamer",
    "Eliotrope",
    "Huppermage",
    "Ouginak",
    "Forgelance",
    "Sram",
    "Xelor",
    "Osamodas",
    "Feca",
    "Pandawa",
    "Enutrof",
    "Bonta",
    "Brakmar",
    "Astrub",
    "Incarnam",
    "Amakna",
    "Frigost",
    "Saharach",
    "Pandala",
    "Grobe",
    "Otoma\xEF",
    "Wabbit",
    "Gel\xE9e",
    "Kama",
    "Zaap",
    "Familier",
    "Montilier",
    "Dragodinde",
    "Muldo",
    "Volkorne",
    "Chacha",
    "Bwak",
    "Croum",
    "Nomoon",
    "Nidas",
    "Vortex",
    "Reine des Voleurs",
    "Chaloeil",
    "Guerre",
    "Mis\xE8re",
    "Servitude",
    "Bethel",
    "Tal Kasha",
    "Merkator",
    "Ombre",
    "Koutoulou",
    "Meno",
    "Dantin\xE9a",
    "Ilyzaelle",
    "Julith",
    "Joris",
    "Kerubim",
    "Almanax",
    "Koliz\xE9um",
    "Dopeul",
    "Percepteur",
    "Guilde",
    "Alliance",
    "Prisme",
    "Bouclier",
    "Coiffe",
    "Cape",
    "Bottes",
    "Ceinture",
    "Amulette",
    "Anneau",
    "Cac",
    "\xC9p\xE9e",
    "Arc",
    "Baguette",
    "B\xE2ton",
    "Dagues",
    "Hache",
    "Marteau",
    "Pelle",
    "Faux",
    "Outil",
    "Kralamoure Geant",
    "Ougah",
    "Ch\xEAne Mou",
    "Mansot Royal",
    "Tengu Snowfoux"
  ];
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

// src/server/games/SigilSkribbl/SkribblRoom.ts
function levenshteinDistance(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          // substitution
          Math.min(
            matrix[i][j - 1] + 1,
            // insertion
            matrix[i - 1][j] + 1
          )
          // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
var SkribblRoom = class {
  constructor(io2, manager, config) {
    this.io = io2;
    this.manager = manager;
    this.maxRounds = 3;
    this.roundDuration = 80;
    // secondes
    this.state = "LOBBY";
    this.players = [];
    this.hostId = null;
    // État du jeu en cours
    this.currentRound = 0;
    this.drawerIndex = -1;
    this.currentWord = "";
    this.wordChoices = [];
    this.roundTimer = null;
    this.timeLeft = 0;
    // Canvas history pour les spectateurs qui rejoignent en retard
    this.canvasActions = [];
    this.id = config.id;
    if (config.rounds) this.maxRounds = config.rounds;
    if (config.duration) this.roundDuration = config.duration;
  }
  emitToAll(event, data) {
    if (data) this.io.to(this.id).emit(event, data);
    else this.io.to(this.id).emit(event);
  }
  emitTo(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }
  isHost(socketId) {
    return this.hostId === socketId;
  }
  isEmpty() {
    return this.players.filter((p) => p.isConnected).length === 0;
  }
  addPlayer(socket, playerObj) {
    const existing = this.players.find((p) => p.id === socket.id || playerObj.userId && p.userId === playerObj.userId);
    if (existing) {
      existing.isConnected = true;
      existing.id = socket.id;
    } else {
      const newPlayer = {
        id: socket.id,
        userId: playerObj.userId,
        pseudo: playerObj.pseudo || `Joueur ${this.players.length + 1}`,
        avatarUrl: playerObj.avatarUrl,
        score: 0,
        hasGuessed: false,
        isDrawing: false,
        isConnected: true
      };
      this.players.push(newPlayer);
      if (!this.hostId) this.hostId = socket.id;
    }
    this.syncState();
    this.emitToAll("skribbl:chat:message", { type: "system", text: `${playerObj.pseudo} a rejoint la salle.` });
    if (this.state === "DRAWING" && this.canvasActions.length > 0) {
      this.emitTo(socket.id, "skribbl:canvas:restore", { actions: this.canvasActions });
    }
  }
  removePlayer(socketId) {
    const player = this.players.find((p) => p.id === socketId);
    if (player) {
      player.isConnected = false;
      this.emitToAll("skribbl:chat:message", { type: "system", text: `${player.pseudo} a quitt\xE9 la salle.` });
      if (this.hostId === socketId) {
        const nextHost = this.players.find((p) => p.isConnected);
        this.hostId = nextHost ? nextHost.id : null;
      }
      if (this.state === "DRAWING" || this.state === "SELECTING_WORD") {
        if (player.isDrawing) {
          this.emitToAll("skribbl:chat:message", { type: "system", text: `Le dessinateur s'est enfui ! Fin du tour.` });
          this.endRound();
        } else {
          this.checkRoundEndConditions();
        }
      }
      this.syncState();
    }
  }
  syncState() {
    const publicPlayers = this.players.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      avatarUrl: p.avatarUrl,
      score: p.score,
      hasGuessed: p.hasGuessed,
      isDrawing: p.isDrawing,
      isConnected: p.isConnected
    }));
    const statePayload = {
      id: this.id,
      state: this.state,
      hostId: this.hostId,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      // Info secrète (Seul le dessinateur la reçoit normalement, ou on l'anonymise)
      currentWordMask: this.getWordMask(),
      drawerId: this.players[this.drawerIndex]?.id,
      players: publicPlayers
    };
    this.emitToAll("skribbl:state:sync", statePayload);
  }
  startGame() {
    if (this.state !== "LOBBY") return;
    this.currentRound = 1;
    this.drawerIndex = -1;
    this.players.forEach((p) => {
      p.score = 0;
    });
    this.startNextTurn();
  }
  startNextTurn() {
    const connectedPlayers = this.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      this.state = "LOBBY";
      this.emitToAll("skribbl:chat:message", { type: "system", text: `Pas assez de joueurs pour continuer... Retour au lobby.` });
      this.syncState();
      return;
    }
    this.drawerIndex++;
    if (this.drawerIndex >= this.players.length) {
      this.drawerIndex = 0;
      this.currentRound++;
      if (this.currentRound > this.maxRounds) {
        this.endGame();
        return;
      }
    }
    const nextDrawer = this.players[this.drawerIndex];
    if (!nextDrawer || !nextDrawer.isConnected) {
      return this.startNextTurn();
    }
    this.players.forEach((p) => {
      p.hasGuessed = false;
      p.isDrawing = p.id === nextDrawer.id;
    });
    this.currentWord = "";
    this.canvasActions = [];
    this.state = "SELECTING_WORD";
    this.wordChoices = getDofusWords(3);
    this.emitToAll("skribbl:chat:message", { type: "system", text: `${nextDrawer.pseudo} est en train de choisir un mot...` });
    this.emitTo(nextDrawer.id, "skribbl:word:choose", { words: this.wordChoices });
    this.syncState();
    this.timeLeft = 15;
    this.startTimer(() => {
      this.handleWordChoice(nextDrawer.id, this.wordChoices[0]);
    });
  }
  handleWordChoice(socketId, word) {
    if (this.state !== "SELECTING_WORD") return;
    const drawer = this.players[this.drawerIndex];
    if (!drawer || drawer.id !== socketId) return;
    this.currentWord = word;
    this.state = "DRAWING";
    this.emitToAll("skribbl:chat:message", { type: "system", text: `${drawer.pseudo} dessine !` });
    this.emitTo(drawer.id, "skribbl:word:start", { word: this.currentWord });
    this.syncState();
    this.timeLeft = this.roundDuration;
    this.startTimer(() => {
      this.endRound();
    });
  }
  handleGuess(socket, text) {
    const player = this.players.find((p) => p.id === socket.id);
    if (!player || player.isDrawing || player.hasGuessed || this.state !== "DRAWING") return;
    const guess = text.trim();
    const dist = levenshteinDistance(guess, this.currentWord);
    const maxLen = Math.max(guess.length, this.currentWord.length);
    if (dist === 0) {
      player.hasGuessed = true;
      const points = Math.floor(this.timeLeft / this.roundDuration * 100) + 50;
      player.score += points;
      const drawer = this.players[this.drawerIndex];
      if (drawer) drawer.score += 20;
      this.emitToAll("skribbl:chat:message", { type: "success", text: `${player.pseudo} a trouv\xE9 le mot !` });
      this.syncState();
      this.checkRoundEndConditions();
    } else if (dist <= 2 && maxLen > 4) {
      this.emitToAll("skribbl:chat:message", { type: "guess", text: `${player.pseudo}: ${guess}` });
      this.emitTo(socket.id, "skribbl:chat:message", { type: "warning", text: `'${guess}' est presque exact !` });
    } else {
      this.emitToAll("skribbl:chat:message", { type: "guess", text: `${player.pseudo}: ${guess}` });
    }
  }
  checkRoundEndConditions() {
    const activeGuessers = this.players.filter((p) => p.isConnected && !p.isDrawing);
    const allGuessed = activeGuessers.every((p) => p.hasGuessed);
    if (allGuessed && activeGuessers.length > 0) {
      this.endRound();
    }
  }
  endRound() {
    this.stopTimer();
    this.state = "ROUND_END";
    this.emitToAll("skribbl:chat:message", { type: "system", text: `Le mot \xE9tait : ${this.currentWord}` });
    this.syncState();
    setTimeout(() => {
      this.startNextTurn();
    }, 5e3);
  }
  endGame() {
    this.state = "GAME_END";
    this.syncState();
    setTimeout(() => {
      this.state = "LOBBY";
      this.syncState();
    }, 1e4);
  }
  getWordMask() {
    if (!this.currentWord) return "";
    return this.currentWord.replace(/[a-zA-ZÀ-ÿ]/g, "_");
  }
  startTimer(onTimeout) {
    this.stopTimer();
    this.roundTimer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.stopTimer();
        onTimeout();
      } else {
        this.emitToAll("skribbl:time:tick", { timeLeft: this.timeLeft });
      }
    }, 1e3);
  }
  stopTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
  destroy() {
    this.stopTimer();
  }
};

// src/server/games/SigilSkribbl/SkribblManager.ts
function generateShortId2() {
  return "DRAW-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}
var SkribblManager = class {
  constructor(io2) {
    this.io = io2;
    this.rooms = /* @__PURE__ */ new Map();
  }
  registerSocket(socket) {
    socket.on("skribbl:room:create", (config) => this.createRoom(socket, config));
    socket.on("skribbl:room:join", ({ roomId, playerObj }) => this.joinRoom(socket, roomId, playerObj));
    socket.on("skribbl:draw:stroke", (data) => this.relayToRoom(socket, "skribbl:draw:stroke", data));
    socket.on("skribbl:draw:clear", () => this.relayToRoom(socket, "skribbl:draw:clear"));
    socket.on("skribbl:draw:undo", () => this.relayToRoom(socket, "skribbl:draw:undo"));
    socket.on("skribbl:draw:fill", (data) => this.relayToRoom(socket, "skribbl:draw:fill", data));
    socket.on("skribbl:chat:guess", ({ text }) => this.handleGuess(socket, text));
    socket.on("skribbl:game:start", () => this.handleStart(socket));
    socket.on("skribbl:word:select", ({ word }) => this.handleWordChoice(socket, word));
  }
  async setSocketRoom(socketId, roomId) {
    await redis.set(`socket:skribbl:${socketId}:room`, roomId, "EX", 3600);
  }
  async getSocketRoom(socketId) {
    return await redis.get(`socket:skribbl:${socketId}:room`);
  }
  async delSocketRoom(socketId) {
    await redis.del(`socket:skribbl:${socketId}:room`);
  }
  async createRoom(socket, config) {
    const roomId = generateShortId2();
    const room = new SkribblRoom(this.io, this, { ...config, id: roomId });
    this.rooms.set(roomId, room);
    logger.info(`[Skribbl] Room cr\xE9\xE9e: ${roomId} par ${socket.id}`);
    socket.emit("skribbl:room:created", { roomId });
  }
  async joinRoom(socket, roomId, playerObj) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit("skribbl:error", { message: "Salon introuvable ou ferm\xE9." });
      return;
    }
    socket.join(roomId);
    await this.setSocketRoom(socket.id, roomId);
    room.addPlayer(socket, playerObj);
  }
  async relayToRoom(socket, event, data) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    if (data !== void 0) {
      socket.to(roomId).emit(event, data);
    } else {
      socket.to(roomId).emit(event);
    }
  }
  async handleGuess(socket, text) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room) room.handleGuess(socket, text);
  }
  async handleStart(socket) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room && room.isHost(socket.id)) {
      room.startGame();
    }
  }
  async handleWordChoice(socket, word) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room) room.handleWordChoice(socket, word);
  }
  async handleDisconnect(socket, reason) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(socket.id);
      if (room.isEmpty()) {
        logger.info(`[Skribbl] Room ${roomId} d\xE9truite (vide).`);
        room.destroy();
        this.rooms.delete(roomId);
      }
    }
    await this.delSocketRoom(socket.id);
  }
};

// src/server/games/SigilGuesser/GeoguesserRoom.ts
var GeoguesserRoom = class {
  constructor(io2, config) {
    this.io = io2;
    this.maxRounds = 5;
    this.timePerRound = 30;
    // secondes
    this.state = "LOBBY";
    this.players = [];
    this.hostId = null;
    this.currentRound = 0;
    this.targetMapIds = [];
    this.roundTimer = null;
    this.timeLeft = 0;
    this.id = config.id;
    this.guildId = config.guildId;
    if (config.maxRounds) this.maxRounds = config.maxRounds;
    if (config.timePerRound) this.timePerRound = config.timePerRound;
  }
  emitToAll(event, data) {
    if (data) this.io.to(this.id).emit(event, data);
    else this.io.to(this.id).emit(event);
  }
  emitTo(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }
  isHost(socketId) {
    return this.hostId === socketId;
  }
  isEmpty() {
    return this.players.filter((p) => p.isConnected).length === 0;
  }
  addPlayer(socket, playerObj) {
    const existing = this.players.find((p) => p.id === socket.id || p.userId === playerObj.userId);
    if (existing) {
      existing.isConnected = true;
      existing.id = socket.id;
    } else {
      const newPlayer = {
        id: socket.id,
        userId: playerObj.userId,
        pseudo: playerObj.pseudo,
        avatarUrl: playerObj.avatarUrl,
        score: 0,
        hasGuessed: false,
        isConnected: true,
        lastGuess: null
      };
      this.players.push(newPlayer);
      if (!this.hostId) this.hostId = socket.id;
    }
    this.syncState();
  }
  handleLateJoin(socket) {
    this.syncState();
  }
  removePlayer(socketId) {
    const player = this.players.find((p) => p.id === socketId);
    if (player) {
      player.isConnected = false;
      if (this.hostId === socketId) {
        const nextHost = this.players.find((p) => p.isConnected);
        this.hostId = nextHost ? nextHost.id : null;
      }
      if (this.state === "IN_PROGRESS") {
        this.checkRoundEndConditions();
      }
      this.syncState();
    }
  }
  syncState() {
    const statePayload = {
      id: this.id,
      guildId: this.guildId,
      state: this.state,
      hostId: this.hostId,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      timePerRound: this.timePerRound,
      targetMapIds: this.targetMapIds,
      players: this.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        pseudo: p.pseudo,
        avatarUrl: p.avatarUrl,
        score: p.score,
        hasGuessed: p.hasGuessed,
        isConnected: p.isConnected,
        // On cache la distance/x/y tant que tout le monde n'a pas répondu (si IN_PROGRESS)
        lastGuess: this.state === "RESULT" ? p.lastGuess : p.hasGuessed ? { hidden: true } : null
      }))
    };
    this.emitToAll("geoguesser:state:sync", statePayload);
  }
  startGame(targetMapIds) {
    if (this.state !== "LOBBY") return;
    this.targetMapIds = targetMapIds || [];
    this.currentRound = 0;
    this.players.forEach((p) => {
      p.score = 0;
      p.lastGuess = null;
      p.hasGuessed = false;
    });
    this.startNextRound();
  }
  startNextRound() {
    this.currentRound++;
    if (this.currentRound > this.maxRounds || this.currentRound > this.targetMapIds.length) {
      this.endGame();
      return;
    }
    this.state = "IN_PROGRESS";
    this.players.forEach((p) => {
      p.hasGuessed = false;
      p.lastGuess = null;
    });
    this.syncState();
    this.timeLeft = this.timePerRound;
    this.startTimer(() => {
      this.state = "RESULT";
      this.syncState();
    });
  }
  triggerNextRound(socket) {
    if (this.isHost(socket.id) && this.state === "RESULT") {
      this.startNextRound();
    }
  }
  handleGuess(socket, data) {
    const player = this.players.find((p) => p.id === socket.id);
    if (!player || player.hasGuessed || this.state !== "IN_PROGRESS") return;
    player.hasGuessed = true;
    player.score += data.score;
    player.lastGuess = {
      x: data.x,
      y: data.y,
      score: data.score,
      distance: data.distance
    };
    this.syncState();
    this.checkRoundEndConditions();
  }
  checkRoundEndConditions() {
    const activeGuessers = this.players.filter((p) => p.isConnected);
    const allGuessed = activeGuessers.every((p) => p.hasGuessed);
    if (allGuessed && activeGuessers.length > 0) {
      this.stopTimer();
      this.state = "RESULT";
      this.syncState();
    }
  }
  endGame() {
    this.state = "FINISHED";
    this.syncState();
    setTimeout(() => {
      if (this.state === "FINISHED") {
        this.state = "LOBBY";
        this.syncState();
      }
    }, 15e3);
  }
  startTimer(onTimeout) {
    this.stopTimer();
    this.roundTimer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.stopTimer();
        onTimeout();
      }
    }, 1e3);
  }
  stopTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
  handlePlayerDisconnect(socketId, reason) {
    this.removePlayer(socketId);
  }
  destroy() {
    this.stopTimer();
  }
};

// src/server/games/SigilGuesser/GeoguesserManager.ts
var GeoguesserManager = class {
  constructor(io2) {
    this.io = io2;
    this.rooms = /* @__PURE__ */ new Map();
  }
  registerSocket(socket) {
    socket.on("geoguesser:room:join", (data) => this.joinRoom(socket, data));
    socket.on("geoguesser:game:start", (data) => this.startGame(socket, data));
    socket.on("geoguesser:guess:submit", (data) => this.handleGuess(socket, data));
    socket.on("geoguesser:game:next-round", () => this.triggerNextRound(socket));
  }
  async triggerNextRound(socket) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.triggerNextRound(socket);
  }
  async setSocketRoom(socketId, roomId) {
    await redis.set(`socket:${socketId}:georoom`, roomId, "EX", 3600);
  }
  async getSocketRoom(socketId) {
    return await redis.get(`socket:${socketId}:georoom`);
  }
  async delSocketRoom(socketId) {
    await redis.del(`socket:${socketId}:georoom`);
  }
  async joinRoom(socket, data) {
    const { roomId, pseudo, userId, avatarUrl, guildId, maxRounds, timePerRound } = data;
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new GeoguesserRoom(this.io, {
        id: roomId,
        guildId: guildId || "global",
        maxRounds: maxRounds || 5,
        timePerRound: timePerRound || 30
      });
      this.rooms.set(roomId, room);
    }
    socket.join(roomId);
    await this.setSocketRoom(socket.id, roomId);
    room.addPlayer(socket, { pseudo, userId, avatarUrl });
    room.handleLateJoin(socket);
    socket.emit("geoguesser:room:joined", { roomId });
  }
  async startGame(socket, data) {
    const { targetMapIds } = data;
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.isHost(socket.id)) {
      room.startGame(targetMapIds);
    }
  }
  async handleGuess(socket, data) {
    const { x, y, score, distance, round } = data;
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.handleGuess(socket, { x, y, score, distance });
  }
  async handleDisconnect(socket, reason) {
    const roomId = await this.getSocketRoom(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.handlePlayerDisconnect(socket.id, reason);
    await this.delSocketRoom(socket.id);
    if (room.isEmpty()) {
      room.destroy();
      this.rooms.delete(roomId);
    }
  }
};

// src/server/websocket/server.ts
var PORT = 3001;
var httpServer = (0, import_http.createServer)();
var pubClient = redis.duplicate();
var subClient = redis.duplicate();
var io = new import_socket.Server(httpServer, {
  cors: {
    origin: "*",
    // En dev on accepte tout. En prod on pourra restreindre.
    methods: ["GET", "POST"],
    credentials: true
  },
  adapter: (0, import_redis_adapter.createAdapter)(pubClient, subClient)
});
var garticManager = new GameManager(io);
var skribblManager = new SkribblManager(io);
var geoguesserManager = new GeoguesserManager(io);
io.on("connection", (socket) => {
  logger.info(`[WS] \u{1F7E2} Client connect\xE9: ${socket.id}`);
  garticManager.registerSocket(socket);
  skribblManager.registerSocket(socket);
  geoguesserManager.registerSocket(socket);
  socket.on("disconnect", (reason) => {
    logger.info(`[WS] \u{1F534} Client d\xE9connect\xE9: ${socket.id} (Raison: ${reason})`);
    garticManager.handleDisconnect(socket, reason);
    skribblManager.handleDisconnect(socket, reason);
    geoguesserManager.handleDisconnect(socket, reason);
  });
});
httpServer.listen(PORT, () => {
  logger.info(`[WS] \u{1F680} Serveur WebSocket d\xE9marr\xE9 sur le port ${PORT}`);
});
var shutdown = () => {
  logger.info("[WS] Extinction du serveur WebSocket...");
  io.close(() => {
    httpServer.close(() => {
      logger.info("[WS] Serveur ferm\xE9.");
      process.exit(0);
    });
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
