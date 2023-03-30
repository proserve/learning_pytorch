'use strict'

const _ = require('underscore'),
      fs = require('fs'),
      path = require('path'),
      serviceRoot = require('cortex-service/lib/init-config'),
      config = require('cortex-service/lib/config'),
      zxcvbn = require('zxcvbn'),
      Fault = require('cortex-service/lib/fault'),
      IncomingMessage = require('http').IncomingMessage,
      objectUtils = require('cortex-service/lib/utils/objects'),
      idUtils = require('cortex-service/lib/utils/ids'),
      bsonUtils = require('cortex-service/lib/utils/bson'),
      pathUtils = require('cortex-service/lib/utils/paths'),
      ipUtils = require('cortex-service/lib/utils/ips'),
      jsonUtils = require('cortex-service/lib/utils/json'),
      valueUtils = require('cortex-service/lib/utils/values'),
      versionUtils = require('cortex-service/lib/utils/versions'),
      me = require('mongo-escape'),
      hasOwnProperty = Object.prototype.hasOwnProperty,
      __proto__ = '__proto__',

      packageJson = require('../package.json'),
      util = require('util'),
      lazy = require('cortex-service/lib/lazy-loader').from({
        mongooseUtils: () => require('mongoose/lib/utils'),
        safePathTo: () => require('./classes/pather').sandbox,
        modules: `${__dirname}/modules`,
        storage: () => lazy.modules.storage,
        streams: () => lazy.modules.streams
      }),

      { OutputCursor, prepareResult, asyncHandler } = require('cortex-service/lib/utils/output'),
      outputResults = require('./outputResults'),
      { rInt, array: toArray } = valueUtils,
      UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-4][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      codePool = [

        'fabric', 'fabrics', 'fabulous', 'faced', 'faces', 'facial', 'facility', 'facing', 'factor', 'factors', 'factory',
        'facts', 'faculty', 'failed', 'failing', 'fails', 'failure', 'failures', 'fairly', 'fairy', 'faith', 'fallen', 'falling',
        'falls', 'false', 'familiar', 'families', 'family', 'famous', 'fancy', 'fantasy', 'fares', 'farmer', 'farmers', 'farming',
        'farms', 'fashion', 'faster', 'fastest', 'fatal', 'father', 'fathers', 'fatty', 'fault', 'favor', 'favorite', 'favors', 'fears',
        'feature', 'featured', 'features', 'february', 'federal', 'feedback', 'feeding', 'feeds', 'feeling', 'feelings', 'feels',
        'fellow', 'female', 'females', 'fence', 'fernando', 'ferrari', 'ferry', 'festival', 'fetish', 'fever', 'fewer', 'fiber', 'fibre',
        'fiction', 'field', 'fields', 'fifteen', 'fifth', 'fifty', 'fight', 'fighter', 'fighters', 'fighting', 'figure',
        'figured', 'figures', 'filed', 'filename', 'files', 'filing', 'filled', 'filling', 'films', 'filter',
        'filters', 'final', 'finally', 'finals', 'finance', 'finances', 'finder', 'finding', 'findings', 'findlaw', 'finds',
        'finest', 'finger', 'fingers', 'finish', 'finished', 'finite', 'finland', 'finnish', 'fioricet', 'fired',
        'fires', 'firewall', 'firewire', 'firms', 'firmware', 'first', 'fiscal', 'fisher', 'fishing', 'fitness', 'fitted',
        'fitting', 'fixed', 'fixes', 'fixtures', 'flags', 'flame', 'flash', 'flashers', 'flashing', 'flavor', 'fleece', 'fleet',
        'flesh', 'flexible', 'flickr', 'flight', 'flights', 'float', 'floating', 'flood', 'floor', 'flooring', 'floors',
        'floppy', 'floral', 'florence', 'florida', 'florist', 'florists', 'flour', 'flower', 'flowers', 'flows', 'floyd',
        'fluid', 'flush', 'flyer', 'flying', 'focal', 'focus', 'focused', 'focuses', 'focusing', 'folder', 'folders', 'folding',
        'folks', 'follow', 'followed', 'follows', 'fonts', 'foods', 'footage', 'football', 'footwear', 'forbes', 'force', 'forced',
        'forces', 'forecast', 'foreign', 'forest', 'forestry', 'forests', 'forever', 'forge', 'forget', 'forgot', 'formal', 'format',
        'formats', 'formed', 'former', 'formerly', 'forming', 'forms', 'formula', 'forth', 'fortune', 'forty', 'forum', 'forums',
        'forward', 'fossil', 'foster', 'fotos', 'fought', 'found', 'founded', 'founder', 'fountain', 'fourth', 'fraction',
        'frame', 'framed', 'frames', 'framing', 'france', 'francis', 'frank', 'franklin', 'fraser', 'fraud', 'freedom',
        'freely', 'freeware', 'freeze', 'freight', 'french', 'frequent', 'fresh', 'friday', 'fridge', 'friend', 'friendly',
        'friends', 'front', 'frontier', 'frost', 'frozen', 'fruit', 'fruits', 'fully', 'function', 'funded', 'funding',
        'funds', 'funeral', 'funky', 'funny', 'further', 'fusion', 'future', 'futures', 'fuzzy',

        'jacket', 'jackets', 'jackson', 'jaguar', 'jamaica', 'james', 'jamie', 'janet', 'january',
        'japan', 'jason', 'jeans', 'jeffrey', 'jelsoft', 'jennifer', 'jenny', 'jeremy', 'jerry', 'jersey', 'jesse', 'jessica',
        'jewel', 'jewelry', 'jimmy', 'johnny', 'johns', 'johnson', 'johnston', 'joined', 'joining', 'joins', 'joint', 'jokes',
        'jonathan', 'jones', 'jordan', 'joseph', 'joshua', 'journal', 'journals', 'journey', 'joyce', 'judge', 'judges',
        'judgment', 'judicial', 'juice', 'julia', 'julian', 'julie', 'jumping', 'junction', 'jungle', 'junior', 'justice',
        'justify', 'justin', 'juvenile',

        'machine', 'machines', 'macro', 'madison', 'madness', 'madonna', 'madrid', 'magazine', 'magic', 'magical', 'magnet',
        'magnetic', 'maiden', 'mailed', 'mailing', 'mailman', 'mails', 'mailto', 'maine', 'mainland', 'mainly', 'maintain',
        'major', 'majority', 'maker', 'makers', 'makes', 'makeup', 'making', 'males', 'malta', 'mambo', 'manage', 'managed',
        'manager', 'managers', 'managing', 'mandate', 'manga', 'manitoba', 'manner', 'manor', 'manual', 'manually', 'manuals',
        'maple', 'mapping', 'marathon', 'marble', 'march', 'marco', 'marcus', 'mardi', 'margaret', 'margin', 'maria', 'mariah',
        'marie', 'marilyn', 'marina', 'marine', 'mario', 'marion', 'maritime', 'marked', 'marker', 'markers', 'market', 'markets',
        'marking', 'marks', 'marriage', 'married', 'marriott', 'marsh', 'marshall', 'martha', 'martial', 'martin', 'marvel',
        'maryland', 'mason', 'massage', 'massive', 'masters', 'match', 'matched', 'matches', 'matching', 'material',
        'mating', 'matrix', 'matter', 'matters', 'matthew', 'mattress', 'mature', 'maximize', 'maximum', 'maybe', 'mayor',
        'mazda', 'meals', 'meaning', 'means', 'meant', 'measure', 'measured', 'measures', 'medal', 'media', 'median',
        'medicaid', 'medical', 'medicare', 'medicine', 'medieval', 'medium', 'medline', 'meeting', 'meetings', 'meets',
        'meetup', 'member', 'members', 'membrane', 'memorial', 'memories', 'memory', 'memphis', 'mental', 'mention',
        'mentor', 'menus', 'mercedes', 'merchant', 'mercury', 'mercy', 'merely', 'merge', 'merger', 'merit', 'merry', 'message',
        'messages', 'metadata', 'metal', 'metallic', 'metals', 'meter', 'meters', 'method', 'methods', 'metres', 'metric',
        'metro', 'mexico', 'meyer', 'miami', 'michael', 'michel', 'michelle', 'michigan', 'micro', 'middle', 'midlands',
        'midnight', 'midwest', 'might', 'mighty', 'milan', 'mileage', 'miles', 'military', 'miller', 'million', 'millions',
        'mills', 'milton', 'minds', 'mineral', 'minerals', 'mines', 'minimal', 'minimize', 'minimum', 'mining', 'minister',
        'ministry', 'minolta', 'minor', 'minority', 'minus', 'minute', 'minutes', 'miracle', 'mirror', 'mirrors', 'missed',
        'missile', 'missing', 'mission', 'missions', 'missouri', 'mistake', 'mistakes', 'mistress', 'mitchell', 'mixed', 'mixer',
        'mixing', 'mixture', 'mobile', 'mobiles', 'mobility', 'model', 'modeling', 'models', 'modem', 'modems', 'moderate',
        'modern', 'modes', 'modified', 'modify', 'modular', 'module', 'modules', 'moisture', 'moldova', 'moment', 'moments',
        'momentum', 'monaco', 'monday', 'monetary', 'money', 'mongolia', 'monica', 'monitor', 'monitors', 'monkey', 'monroe',
        'montana', 'monte', 'month', 'monthly', 'months', 'montreal', 'moore', 'moral', 'moreover', 'morgan', 'morning',
        'morocco', 'morris', 'morrison', 'mortgage', 'moses', 'mostly', 'motel', 'motels', 'mother', 'mothers',
        'motion', 'motor', 'motorola', 'motors', 'mount', 'mountain', 'mounted', 'mounting', 'mounts', 'mouse', 'mouth',
        'moved', 'movement', 'movers', 'moves', 'movie', 'movies', 'moving', 'multi', 'multiple', 'mumbai', 'munich', 'murphy',
        'murray', 'muscle', 'muscles', 'museum', 'museums', 'music', 'musical', 'musician', 'muslim', 'muslims', 'mustang',
        'mutual', 'myers', 'myrtle', 'myself', 'mystery',

        'table', 'tables', 'tablet', 'tablets', 'tackle', 'tactics', 'tagged', 'tahoe', 'taiwan', 'taken', 'takes', 'taking',
        'talent', 'talented', 'tales', 'talked', 'talking', 'talks', 'tamil', 'tampa', 'tanks', 'tanzania', 'tapes', 'target',
        'targeted', 'targets', 'tariff', 'tasks', 'taste', 'tattoo', 'taught', 'taylor', 'teach', 'teacher', 'teachers',
        'teaches', 'teaching', 'teams', 'tears', 'techno', 'teddy', 'teeth', 'telecom', 'telling',
        'tells', 'template', 'temple', 'temporal', 'tenant', 'tender', 'tennis', 'tension', 'terminal', 'terms', 'terrace',
        'terrain', 'terrible', 'terror', 'terry', 'tested', 'testing', 'tests', 'texas', 'textbook', 'textile', 'textiles',
        'texts', 'texture', 'thailand', 'thank', 'thanks', 'thats', 'theater', 'theaters', 'theatre', 'their', 'theme',
        'themes', 'theology', 'theorem', 'theories', 'theory', 'therapy', 'there', 'thereby', 'thereof', 'thermal',
        'these', 'thesis', 'theta', 'thick', 'thing', 'things', 'think', 'thinking', 'thinkpad', 'thinks', 'third',
        'thirty', 'thomas', 'thompson', 'thomson', 'thorough', 'those', 'though', 'thought', 'thoughts', 'thousand', 'thread',
        'threaded', 'threads', 'threat', 'threats', 'three', 'thriller', 'through', 'throw', 'throwing', 'thrown',
        'throws', 'thunder', 'thursday', 'ticket', 'tickets', 'tiger', 'tigers', 'tight', 'tiles', 'tim', 'timber', 'timeline',
        'timely', 'timer', 'times', 'timing', 'tires', 'tissue', 'titanium', 'titans', 'title', 'titled', 'titles', 'tobago',
        'today', 'toddler', 'together', 'toilet', 'token', 'tokyo', 'tomato', 'tomatoes', 'tommy', 'tomorrow', 'toner',
        'tones', 'tongue', 'tonight', 'toolbar', 'toolbox', 'toolkit', 'tools', 'tooth', 'topic', 'topics', 'toronto', 'total',
        'totally', 'totals', 'tough', 'touring', 'tourism', 'tourist', 'tours', 'toward', 'towards', 'tower', 'towers', 'towns',
        'township', 'trace', 'track', 'tracked', 'tracker', 'tracking', 'tracks', 'tract', 'tractor', 'tracy', 'trade', 'trader',
        'trades', 'trading', 'traffic', 'tragedy', 'trail', 'trailer', 'trailers', 'trails', 'train', 'trained', 'trainer',
        'trainers', 'training', 'trains', 'trance', 'transfer', 'transit', 'transmit', 'trash', 'travel', 'traveler',
        'travels', 'travis', 'treasure', 'treasury', 'treat', 'treated', 'treating', 'treaty', 'trees', 'trend', 'trends',
        'trial', 'trials', 'triangle', 'tribune', 'tribute', 'trick', 'tricks', 'tried', 'tries', 'trigger', 'trinidad',
        'trinity', 'triple', 'trips', 'triumph', 'trivia', 'troops', 'tropical', 'trouble', 'trout', 'truck', 'trucks', 'truly',
        'trunk', 'trust', 'trusted', 'trustee', 'trustees', 'trusts', 'truth', 'trying', 'tsunami', 'tubes', 'tucson', 'tuesday',
        'tuition', 'tulsa', 'tuner', 'tunes', 'tuning', 'tunisia', 'tunnel', 'turbo', 'turkey', 'turkish', 'turned', 'turner',
        'turning', 'turns', 'turtle', 'tutorial', 'twelve', 'twenty', 'twice', 'twins', 'twist', 'tyler', 'types', 'typical', 'typing'
      ]

let Undefined

// call promisified and scoped
async function promised(scope, fn, ...args) {
  const p = util.promisify(_.isFunction(fn) ? fn : pathUtils.path(scope, fn))
  return p.call(scope, ...args)
}

function randomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

module.exports = {

  randomInt,
  isPlainObject: objectUtils.isPlainObject,
  extend: require('extend'),
  isPlainObjectWithSubstance: objectUtils.isPlainObjectWithSubstance,
  hasOwnProperties: objectUtils.hasOwnProperties,
  isCircular: objectUtils.isCircular,
  visit: objectUtils.visit,
  walk: objectUtils.walk,
  deepEquals: objectUtils.deepEquals,

  OBJECT_ID_REGEXP: idUtils.OBJECT_ID_REGEXP,
  bson: bsonUtils.bson,
  isBSONType: bsonUtils.isBSONType,
  isBSONTypeOf: bsonUtils.isBSONTypeOf,
  getBSONTypeOf: bsonUtils.getBSONTypeOf,
  isIdFormat: idUtils.isIdFormat,
  couldBeId: idUtils.couldBeId,
  equalIds: idUtils.equalIds,
  timestampToId: idUtils.timestampToId,
  idToTimestamp: idUtils.idToTimestamp,
  createId: idUtils.createId,
  getIdOrNull: idUtils.getIdOrNull,
  indexOfId: idUtils.indexOfId,
  inIdArray: idUtils.inIdArray,
  getIdArray: idUtils.getIdArray,
  uniqueIdArray: idUtils.uniqueIdArray,
  lookupId: idUtils.lookupId,
  findIdPos: idUtils.findIdPos,
  findIdInArray: idUtils.findIdInArray,
  diffIdArrays: idUtils.diffIdArrays,
  intersectIdArrays: idUtils.intersectIdArrays,
  idArrayUnion: idUtils.idArrayUnion,
  isId: idUtils.isId,
  path: pathUtils.path,
  dotPath: pathUtils.dotPath,
  pathDel: pathUtils.pathDel,
  pathParts: pathUtils.pathParts,
  normalizeObjectPath: pathUtils.normalizeObjectPath,
  pathToPayload: pathUtils.pathToPayload,
  optimizePathSelections: pathUtils.optimizePathSelections,
  flattenProjection: pathUtils.flattenProjection,
  flattenObjectPaths: pathUtils.flattenObjectPaths,

  aton: ipUtils.aton,
  is_ipv4: ipUtils.is_ipv4,
  is_cidr: ipUtils.is_cidr,
  contains_ip: ipUtils.contains_ip,
  ntoa: ipUtils.ntoa,
  localIp: ipUtils.localIp,
  ip4toint: ipUtils.ip4toint,
  inttoip4: ipUtils.inttoip4,
  ip4incidr: ipUtils.ip4incidr,

  // digIntoResolved: pathUtils.digIntoResolved,
  // supports unique keys and safer paths
  digIntoResolved: function(obj = null, path = null, allowAnyProperty = false, multiBranch = false, uniqueKeys = false) {

    const parts = Array.isArray(path) ? path : _.isString(path) ? path.split('.') : ''

    for (let i = 0; valueUtils.isSet(obj) && i < parts.length; i++) {

      let isUniqueKey

      path = parts[i]
      if (path === __proto__) {
        return Undefined
      }

      isUniqueKey = uniqueKeys && (module.exports.isCustomName(path, ['c_', 'o_']) || module.exports.isUuidString(path))

      if ((valueUtils.isInteger(path) && path === String(parseInt(path))) || idUtils.couldBeId(path)) {
        if (!Array.isArray(obj)) {
          obj = Undefined
        } else {
          if (multiBranch) {
            if (valueUtils.isInteger(path)) {
              obj = obj[path]
            } else {
              obj = idUtils.findIdInArray(obj, '_id', path)
            }
          } else {
            obj = obj[0]
          }
        }
      } else {
        if (Array.isArray(obj)) {

          // unique keys look in arrays of values but cannot multi-branch.
          if (isUniqueKey) {
            obj = obj[0]
          } else {
            const arr = []
            obj.forEach(function(obj, idx) {
              arr[idx] = module.exports.digIntoResolved(obj, parts.slice(i), allowAnyProperty, multiBranch, uniqueKeys)
            })
            obj = arr

          }
        } else {

          obj = allowAnyProperty ? obj[path] : lazy.safePathTo(obj, path)
        }
      }
    }
    return obj
  },

  getClientIp: function getClientIp(req) {
    let ipAddress
    if (req instanceof IncomingMessage) {
      const forwardedIpsStr = req.header(config('server.proxyProtocolHeader'))
      if (forwardedIpsStr) {
        const forwardedIps = forwardedIpsStr.split(',')
        ipAddress = forwardedIps[0]
      }
      if (!ipAddress) {
        ipAddress = pathUtils.path(req.connection, 'remoteAddress')
      }
      if (ipAddress) {
        const indexOfColon = ipAddress.lastIndexOf(':')
        if (~indexOfColon) {
          ipAddress = ipAddress.substring(indexOfColon + 1, ipAddress.length)
        }
      }
    }
    return ipAddress || null
  },

  toJSON: jsonUtils.toJSON,
  serializeObject: jsonUtils.serializeObject,
  deserializeObject: jsonUtils.deserializeObject,

  encodeME: (v, cacheProperty = null, scope) => {

    if (scope && typeof cacheProperty === 'string') {
      delete scope[cacheProperty]
    }

    return me.escape(
      lazy.mongooseUtils.clone(v),
      true
    )

  },

  decodeME: (v, cacheProperty = null, scope) => {

    if (scope && typeof cacheProperty === 'string') {
      if (valueUtils.isSet(scope[cacheProperty])) {
        return scope[cacheProperty]
      }
    }

    v = lazy.mongooseUtils.clone(v)
    v = me.unescape(
      lazy.mongooseUtils.clone(v)
      , true
    )

    if (scope && typeof cacheProperty === 'string') {
      scope[cacheProperty] = v
    }

    return v

  },

  option: valueUtils.option,
  stringToBoolean: valueUtils.stringToBoolean,
  within: valueUtils.within,
  array: valueUtils.array,
  rVal: valueUtils.rVal,
  rNum: valueUtils.rNum,
  rInt,
  rString: valueUtils.rString,
  rBool: valueUtils.rBool,
  isPrimitive: valueUtils.isPrimitive,
  isSet: valueUtils.isSet,
  dateToAge: valueUtils.dateToAge,
  pad: valueUtils.pad,
  escapeRegex: valueUtils.escapeRegex,
  isInt: valueUtils.isInt,
  isNumeric: valueUtils.isNumeric,
  isInteger: valueUtils.isInteger,
  getValidDate: valueUtils.getValidDate,
  isValidDate: valueUtils.isValidDate,
  clamp: valueUtils.clamp,
  nullFunc: valueUtils.nullFunc,
  ensureCallback: valueUtils.ensureCallback,
  naturalCmp: valueUtils.naturalCmp,
  isReadableStream: valueUtils.isReadableStream,

  compareVersions: versionUtils.compareVersions,
  apVersionEntry: versionUtils.apVersionEntry,
  standardizeVersion: versionUtils.standardizeVersion,

  prepareResult,
  outputResults,
  OutputCursor,

  matchesEnvironment: function(value, defaultValue = '*') {
    if (!valueUtils.isSet(value)) {
      value = defaultValue
    }
    return value === '*' || value === config('app.env')
  },

  isValidMongoDbPropertyKey: function(key) {
    return _.isString(key) && key.length > 0 && key.indexOf('$') !== 0 && !key.match(/[\x00|.]/)
  },

  queryLimit: function queryLimit(limit, script, defaultLimit, maxLimit) {

    if (defaultLimit == null) defaultLimit = config(script ? 'sandbox.defaultListLimit' : 'contexts.defaultLimit')
    if (maxLimit == null) maxLimit = config('contexts.maxLimit')

    limit = Number(limit)
    if (limit % 1 !== 0) {
      limit = defaultLimit
    }
    if (maxLimit === -1) { // -1 means no limit. allow all.
      limit = Math.max(limit, maxLimit)
    } else {
      limit = Math.min(limit, maxLimit)
    }
    return limit
  },

  equals: function(a, b, { strict = true } = {}) {

    if (strict) {
      return a === b
    }
    return a == b // eslint-disable-line eqeqeq
  },

  isEmptyArray: function(arr) {
    return Array.isArray(arr) && arr.length === 0
  },

  isEmptyObject: function(obj) {
    if (!module.exports.isPlainObject(obj)) {
      return false
    }
    for (let key in obj) {
      if (hasOwnProperty.call(obj, key)) {
        return false
      }
    }
    return true
  },

  /**
   * returns true if a variable is null or undefined
   * @param variable
   * @returns {boolean}
   */
  isEmpty: function(variable) {
    return variable === Undefined || variable === null
  },

  resolveOptionsCallback: valueUtils.resolveCallbackArguments,

  asyncWhile: async function(options) {

    const {
            profile = '',
            maxUs = 250,
            while: whileFunc = () => false,
            do: doFunc = () => {},
            sleep: sleepFunc = ({ elapsedUs, maxUs, loop }) => {
              void elapsedUs
              void loop
              void maxUs
              return module.exports.sleep(0)
            }
          } = options || {},
          top = process.hrtime()

    let start = top,
        loop = 0,
        diff,
        elapsedUs

    while (whileFunc()) {

      loop += 1
      diff = process.hrtime(start)
      elapsedUs = diff[0] * 1000000 + diff[1] / 1000

      if (elapsedUs >= maxUs) {
        await sleepFunc({ elapsedUs, maxUs, loop })
        start = process.hrtime()
        loop = 0
      }

      doFunc()
    }

    if (profile) {
      module.exports.profile.end(top, profile)
    }

  },

  profile: {

    whats: {},

    start: function() {
      return process.hrtime()
    },

    end: function(start, what) {

      const diff = process.hrtime(start),
            section = module.exports.profile.whats[what] || (module.exports.profile.whats[what] = {
              count: 0,
              ms: 0
            }),
            ms = ((diff[0] * 1e9 + diff[1]) / 1e6)

      section.count++
      section.ms += ms
      return ms
    },

    fn: function(callback, what) {

      const start = process.hrtime()

      if (callback instanceof Promise) {

        return new Promise((resolve, reject) => {
          callback
            .then(result => {
              module.exports.profile.end(start, what)
              resolve(result)
            })
            .catch(err => {
              module.exports.profile.end(start, what)
              reject(err)
            })
        })

      }

      return function(err, ...args) {
        module.exports.profile.end(start, what)
        callback(err, ...args)
      }
    },

    method: function(what, fn) {

      return function(...args) {

        const start = process.hrtime()

        let err, result

        try {
          result = fn.call(this, ...args)
        } catch (e) {
          err = e
        }

        module.exports.profile.end(start, what)

        if (err) {
          throw err
        }
        return result

      }

    },

    report: function() {

      return Object.entries(module.exports.profile.whats)
        .map(([name, value]) => {
          const { count, ms } = value
          return {
            name,
            avg: (ms / count).toFixed(3),
            count,
            ms
          }
        })
        .sort((a, b) => Number(b.avg) - Number(a.avg))
        .map(v => `${v.avg} - ${v.name}. count: ${v.count}, total: ${v.ms.toFixed(3)}`)
    },

    reset: function() {
      module.exports.profile.whats = {}
    }

  },

  roughSizeOfObject: function(object, maxSize = 0, errCode = 'cortex.tooLarge.unspecified') {

    const objectList = new Set(), stack = [ object ]
    let bytes = 0
    while (stack.length) {

      bytes += _calcSize(stack, objectList, maxSize)

      if (maxSize > 0 && bytes > maxSize) {
        throw Fault.create(errCode)
      }

    }

    return bytes
  },

  roughSizeOfObjectAsync: function(object, maxSize = 0, errCode = 'cortex.tooLarge.unspecified', maxUs = 250) {

    return new Promise((resolve, reject) => {

      let bytes = 0

      const objectList = new Set(),
            stack = [ object ]

      run()

      function run() {

        const start = process.hrtime()

        while (stack.length) {

          const diff = process.hrtime(start)

          bytes += _calcSize(stack, objectList, maxSize)

          if (maxSize > 0 && bytes > maxSize) {
            return reject(Fault.create(errCode))
          } else if ((diff[0] * 1000000 + diff[1] / 1000) >= maxUs) {
            return setImmediate(run)
          }

        }

        resolve(bytes)

      }
    })

  },

  testPasswordStrength: function(value) {

    if (!_.isString(value)) {
      throw Fault.create('cortex.invalidArgument.stringExpected', { path: 'password' })
    } else if (value.length > config('auth.maxPasswordLength')) {
      throw Fault.create('cortex.invalidArgument.maxLength', { reason: `Password cannot be more than ${config('auth.maxPasswordLength')} characters.`, path: 'password' })
    }

    return zxcvbn(value)

  },

  version() {

    return config('version') || packageJson.version

  },

  tryCatch: function tryCatch(fn = () => {}, callback = () => {}, waitLoop = false) {

    let err, result
    try {
      result = _.isFunction(fn) ? fn() : Undefined
    } catch (e) {
      err = e
    }
    if (_.isFunction(callback)) {
      if (waitLoop) {
        setImmediate(callback, err, result)
      } else {
        callback(err, result)
      }
    }
    return [err, result]

  },

  normalizeAcPathParts: function(parts) {

    if (!Array.isArray(parts)) {
      parts = pathUtils.normalizeObjectPath(valueUtils.rString(parts && String(parts), '').replace(/\//g, '.'))
      parts = parts ? parts.split('.') : []
    }
    parts = parts.map(v => {
      // do our best to parse json
      if (_.isString(v) && v[0] === '{') {
        [, v] = module.exports.tryCatch(() => JSON.parse(v))
      }
      return v
    })

    return parts
  },

  promised,

  asyncHandler,

  sleep: function(ms) {
    return new Promise(resolve => {
      const t = Math.max(0, rInt(ms, 0))
      if (t === 0) {
        setImmediate(resolve)
      } else {
        setTimeout(resolve, t)
      }
    })
  },

  callback: function(scope, fn, ...args) {

    const callback = valueUtils.ensureCallback(args.pop()),
          handler = _.isFunction(fn) ? fn : pathUtils.path(scope, fn),
          promise = handler.call(scope, ...args)

    promise
      .then(v => callback(null, v))
      .catch(err => callback(err))

  },

  sortKeys: function(object, deep = false) {

    if (Array.isArray(object)) {

      if (deep) {
        object.forEach((item, idx) => {
          object[idx] = module.exports.sortKeys(item, deep)
        })
      }

    } else if (objectUtils.isPlainObject(object)) {

      const keys = Object.keys(object).sort(valueUtils.naturalCmp),
            sorted = {}

      keys.forEach((key) => {
        sorted[key] = deep ? module.exports.sortKeys(object[key], deep) : object[key]
      })

      object = sorted
    }
    return object
  },

  joinPaths: function(...paths) {

    return paths
      .map(p => (valueUtils.isSet(p) && p !== false) && String(p).trim())
      .filter(v => v)
      .join('.')

  },

  isUuidString: function(uuid) {
    return typeof uuid === 'string' && UuidPattern.test(uuid)
  },

  isCustomName: function(name, prefix = 'c_', allowNs = true, pattern = false) { // more permissive custom name pattern here.

    const prefixes = toArray(prefix, true)

    return typeof name === 'string' &&
      (
        !!prefixes.find(prefix => name.indexOf(prefix) === 0) ||
        (name.includes('__') && allowNs)
      ) &&
      (
        !pattern ||
        pattern.test(name)
      )

  },

  pathPrefix: function(path = null) {
    return pathUtils.pathParts(path)[0]
  },

  pathSuffix: function(path = null) {
    return pathUtils.pathParts(path)[1]
  },

  generateOrgCode: function(len = 3, join = '-') {
    const series = []
    for (let i = 0; i < len; i += 1) {
      series.push(codePool[randomInt(1, codePool.length) - 1])
    }
    return series.join(join)
  },

  pathToSandbox: (sandboxName) => {
    const candidates = [
            path.join(serviceRoot, '/sandbox/build/Release'),
            path.join(serviceRoot, '/sandbox/build/Debug')
          ].concat(process.env.PATH.split(':')),
          result = candidates.find(path => fs.existsSync(`${path}/${sandboxName}`))

    if (result) {
      return `${result}/${sandboxName}`
    } else {
      throw new Error('no sandbox worker exists!')
    }
  }
}

function _calcSize(stack, objectList, maxSize) {

  let bytes = 0

  const value = stack.pop()

  if (value === null || value === Undefined) {
    return 0
  }

  if (typeof value === 'boolean') {
    bytes += 4
  } else if (typeof value === 'string') {
    bytes += value.length * 2
  } else if (typeof value === 'number') {
    bytes += 8
  } else if (Buffer.isBuffer(value)) {
    bytes += value.length
  } else if (typeof value === 'object' && !objectList.has(value)) {
    objectList.add(value)
    if (value instanceof Date) {
      bytes += 12
    } else {
      for (const key of Object.keys(value)) {
        bytes += (key.length * 2)
        stack.push(value[key])
        if (maxSize > 0 && bytes > maxSize) {
          break
        }
      }
    }
  }

  return bytes

}
