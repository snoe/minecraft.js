var s = require('./struct');
var bi = require('./biginteger').BigInteger;

function test(number) {
    b64 = s.floatToNumber(8, number)
    b32 = s.floatToNumber(4, number)
    console.log(number, s.numberToFloat(8, b64), '0x' + b64.toString(16));
    console.log(number, s.numberToFloat(4, b32), '0x' + b32.toString(16));
}

function invtest(number) {
    result = s.numberToFloat(8, number);
    back = s.floatToNumber(8, result);
    console.log('0x'+number.toString(16), '0x'+back.toString(16), result);
}

function fulltest(fmt, bytes) {
    buf = bytes.split(' ').map(function(s) {return parseInt(s, 16)});
    b = Buffer(buf);
    result = s.decode(fmt, b);
    back = s.encode(fmt, result.data);
    
    result.data.forEach(function(r, i) {
        console.log(r, s.encode(fmt[i], [r]));
    }, this);

    console.log(b)
    console.log(back);
}

//fulltest('ddddfff', '40 0c 7e af e3 ec df bf 40 52 67 ae 14 80 00 00 40 52 00 00 00 00 00 00 40 28 89 4f 8e f2 1b 5d c0 b6 bd 00 40 60 1d 18 00 04 00 00 00 00');
console.log(s.numberToFloat(8, bi.parse('0x400c7eafe3ecdfbf')));
//invtest(bi.parse('0xc054f3a27cfac629'));
//test(0);
//invtest(bi.parse(0));
