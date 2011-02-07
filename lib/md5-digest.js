var sys = require('util'),
    crypto = require("crypto");

function decodeDigest (str) {
  var decode = (new Buffer(str+'', 'base64')).toString('ascii');
  var hash = {};
  decode.split(',').forEach(function (chunk) {
    var pair = chunk.split('=');
    hash[pair[0]] = pair[1].replace(/^"|"$/g, '');
  });
  return hash;
}
function encodeDigest (hash) {
  var pairs = [];
  var exceptions = ['charset', 'algorithm', 'response', 'qop', 'nc'];
  for (var k in hash) {
    if (exceptions.indexOf(k) > -1) {
      pairs.push(k+'='+hash[k]);
    } else {
      pairs.push(k+'="'+hash[k]+'"');
    }
  }
  return (new Buffer(pairs.join())).toString('base64');
}
function convertStr2Hex (str) {
  var ret = '';
  str = str.toUpperCase();
  for (var i = 0, l = str.length - 1; i < l; i += 2) {
    var first = str.charCodeAt(i),
    second = str.charCodeAt(i+1);
    if (first >= 48 && first <= 57) {
      first -= 48;
    } else if (first >= 65 && first <= 70) {
      first -= 55;
    } else {
      throw 'error';
    }
    if (second >= 48 && second <= 57) {
      second -= 48;
    } else if (second >= 65 && second <= 70) {
      second -= 55;
    } else {
      throw 'error';
    }
    ret += String.fromCharCode((first << 4) + second);
  }
  return ret;
}

exports.processing = function (str, params, cb) {
  setTimeout(function () {
    var res = decodeDigest(str);
    res.cnonce = +new Date;
    res.nc = '00000001';
    res.username = params.username;
    res.realm = params.realm;
    res['digest-uri'] = params['digest-uri'];
    var crypter = crypto.createHash("md5")
    .update(params.username+':')
    .update(params.realm+':')
    .update(params.password);
    var y = convertStr2Hex(crypter.digest('hex'));
    var ha1 = crypto.createHash("md5")
    .update(y+':'+res.nonce+':'+res.cnonce).digest('hex');
    var ha2 = crypto.createHash("md5")
    .update('AUTHENTICATE:'+params['digest-uri']).digest('hex');
    res.response = crypto.createHash("md5").update([ha1, res.nonce, res.nc, res.cnonce, res.qop, ha2].join(':')).digest('hex');
    cb(encodeDigest(res));
  }, 0);
};