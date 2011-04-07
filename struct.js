var bi = require('./biginteger');
var BigInteger = bi.BigInteger;

var selectMap = {
    0: 'b',
    1: 'S',
    2: 'i',
    3: 'f',
    4: 's',
    5: 'SbS'
}

var sizeMap = {
    'b': 1,
    'S': 2,
    'i': 4,
    'l': 8,
    'd': 8,
    'f': 4
}

var encodeNumber = function(type, number) {
    var size = sizeMap[type];
    if (type == 'f' || type == 'd') {
        number = floatToNumber(size, number);
    }
    var buf = [];
    numstr = padLeft(number.toString(16), 2*size);
    for (var i = 0; i < size*2; i+=2) {
        var slice = numstr.slice(i, i+2);
        var byte = parseInt(slice, 16);
        buf.push(byte);
    }
    return buf; 
}

var floatToNumber = function(size, n) {
    var mantSize = size == 8 ? 52 : 23;
    var expSize = size == 8 ? 11 : 8;
    var bias = size == 8 ? 1023 : 127;

    var binary = Math.abs(n).toString(2);
    var whole = binary.split('.')[0];
    var decimal = binary.split('.')[1] || '0';

    // needs to find first 1
    var shiftbits = whole !== '0' ? whole.length -1 : -1 * (decimal.indexOf('1') + 1);
    var mantissa = whole + decimal
    if (whole !== '0') {
        mantissa = mantissa.slice(1,mantissa.length);
    } else {
        mantissa = mantissa.slice(decimal.indexOf('1') + 2, mantissa.length);
    }
    mantissa = mantissa.slice(0, mantSize + 1);
    mantissa = padRight(mantissa, mantSize);
    
    var exp = n === 0 ? 0 : shiftbits + bias
    var expStr = padLeft(exp.toString(2), expSize);

    var sign = n >= 0 ? '0' : '1';

    var resultStr = sign + expStr + mantissa 
    var result = BigInteger.parse('0b' + resultStr);
    /*
    console.log(sign, expStr, mantissa);
    console.log(resultStr);
    console.log(result, result+5)
    console.log(result.toString(2));
    console.log((result+5).toString(2));
    console.log(shiftbits, exp, bias, result.toString(16), resultStr.length)
    */
    return result;
}

var padLeft = function(str, size) {
    while(str.length < size) {
        str = '0' + str;
    }
    return str;
}

var padRight = function(str, size) {
    while(str.length < size) {
        str = str + '0';
    }
    return str;
}

var numberToFloat = function(size, n) {
    var bits = size === 8 ? 64 : 32;
    var expBits = size == 8 ? 12 : 9; 
    var str = padLeft(n.toString(2), bits);
    var sign = str.slice(0,1) === '1' ? -1 : 1;
    var expStr = str.slice(1, expBits);
    var exp = parseInt(expStr, 2);
    var mantStr = str.slice(expBits, bits)
    var mant = BigInteger.parse('0b' + mantStr);
    var mantAdd = size == 8 ? BigInteger.parse('4503599627370496') : Math.pow(2,23); //(2**51) 

    var decMant = 1 + (mant/mantAdd)
    var decExp = exp - ((((1 << expStr.length) -1)) >> 1)

    var resStr = sign * Math.pow(2,decExp) * decMant
    var resFix = resStr.toFixed(16);
    var result = parseFloat(resFix);
    /*
    console.log('bits', str);
    console.log(sign, expStr, mantStr);
    console.log('exp', exp.toString(2), expStr);
    console.log('decexp', decExp);
    console.log('decmant', decMant);
    console.log('mant', mant.toString(16), mantAdd.toString(16));
    console.log('RESULT', result, resFix, resStr);
    */
    return result;
}

var extractNumber = function(type, buffer) {
    var size = sizeMap[type];
    var numstr = '';
    for (var i = 0; i < size; i++) {
        var byte = buffer[i];
        if (byte === undefined) {
            throw new Error('oob')
        }
        numstr += padLeft(byte.toString(16),2)
    }
    
    number = BigInteger.parse('0x'+numstr);
    if (type==='f' || type==='d') {
        tmp = numberToFloat(size, number);
        number = tmp;
    } else {
        var sign = 1 << ((size*8) - 1);
        if (number & sign) {
            // freaking twos complement
            var mask = (1 << size) - 1;
            number = -1 * ((~number & mask) + 1);
        }
    }
    return number;
}

var extractString = function(size, buffer) {
    str = '';
    for (var i = 0; i < size; i++ ) {
        var byte = buffer[i];
        if (byte === undefined) {
            throw new Error('oob') 
        }
        str += String.fromCharCode(byte)
    }
    return str;
}

var encode = function(fmt, args) {
    var buf = [];
    fmt.split('').forEach(function(type, i) {
        var arg = args[i];
        switch(type) {
            case 's':
                buf = buf.concat(encodeNumber('S', arg.length));
                arg.split('').forEach(function(c) {
                    buf.push(c.charCodeAt(0));
                });
                break;
            case 'd':
            case 'f':
                var numBuf = encodeNumber(type,arg);
                buf = buf.concat(numBuf)
                break;
            default:
                var numBuf = encodeNumber(type,arg);
                buf = buf.concat(numBuf)
                break;
        }
    })

    //console.log('encode', args, '->', buf);
    return new Buffer(buf);
}


var decode = function(fmt, buffer) {
    var vals = [];
    fmt.split('').forEach(function(type) {
        // refactor plz k thx
        // just keep an index into buffer and pass to extract
        // only slice at the end
        // this way, each case can return vals and newindex
        switch(type) {
            case 's':
                var len = extractNumber('S', buffer);
                buffer = buffer.slice(2);
                vals.push(extractString(len, buffer));
                buffer = buffer.slice(len);
                break;
            case 'R': 
                var len = extractNumber('i', buffer);
                buffer = buffer.slice(4);
                vals.push(len);

                for (var i=0; i < len; i++) {
                    vals.push(extractNumber('b', buffer));
                    buffer = buffer.slice(1);
                    vals.push(extractNumber('b', buffer));
                    buffer = buffer.slice(1);
                    vals.push(extractNumber('b', buffer));
                    buffer = buffer.slice(1);
                }
                break;
            case 'X':
                var len = extractNumber('S', buffer);
                buffer = buffer.slice(2);

                var coords = [];
                for (var i = 0; i < len; i++) {
                    coords.push(extractNumber('S', buffer));
                    buffer = buffer.slice(2);
                }

                var types = [];
                for (var i = 0; i < len; i++) {
                    types.push(extractNumber('b', buffer));
                    buffer = buffer.slice(1);
                }

                var blockmeta = [];
                for (var i = 0; i < len; i++) {
                    blockmeta.push(extractNumber('b', buffer));
                    buffer = buffer.slice(1);
                }

                vals.push(len, coords, types, blockmeta);

                break;
            case 'C':
                var len = extractNumber('i', buffer);
                buffer = buffer.slice(4);
                vals.push(len);
                vals.push(buffer.slice(0, len));
                buffer = buffer.slice(len);
                break;
            case 'I':
                // Same as payload
                var id = extractNumber('S', buffer);
                buffer = buffer.slice(2);
                if (id !== -1) {
                    var count = extractNumber('b', buffer);
                    buffer = buffer.slice(1);
                    var uses = extractNumber('S', buffer);
                    buffer = buffer.slice(2);
                    vals.push({count: count, uses: uses, id: id});
                } else {
                    vals.push(id);
                }
                break;
            case 'p':
                var payloadcount = extractNumber('S', buffer);
                buffer = buffer.slice(2);
                vals.push(payloadcount);
                for (var i = 0; i < payloadcount; i++) {
                    var id = extractNumber('S', buffer);
                    buffer = buffer.slice(2);
                    if (id !== -1) {
                        var count = extractNumber('b', buffer);
                        buffer = buffer.slice(1);
                        var uses = extractNumber('S', buffer);
                        buffer = buffer.slice(2);
                        vals.push({count: count, uses: uses, id: id});
                    } else {
                        vals.push(id);
                    }
                }
                break;
            case 'm':
                var byte = extractNumber('b', buffer);
                buffer = buffer.slice(1);
                var meta = [];
                while (byte !== 0x7F) {
                    var select = byte >> 5;
                    var metaformat = selectMap[select];
                    result = decode(metaformat, buffer);
                    buffer = result.remaining;
                    meta = meta.concat(result.data);
                    var byte = extractNumber('b', buffer);
                    buffer = buffer.slice(1);
                }
                vals.push(meta);
                break;
            default:
                vals.push(extractNumber(type, buffer));
                buffer = buffer.slice(sizeMap[type]);
                break
        }
    });

    return {remaining: buffer, data: vals}
}

exports.decode = decode;
exports.encode = encode;
exports.numberToFloat = numberToFloat;
exports.floatToNumber = floatToNumber;
exports.encodeNumber = encodeNumber;
