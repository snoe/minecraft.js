var net = require("net")

var struct = require("./struct")

exports.connect = function(port, address) {
    var client = net.createConnection(port, address)
    var code; 
    var buffer = new Buffer(0);
    var logPosition// = true;

    var onData = function(data) {
        var tmp = new Buffer(data.length + buffer.length)
        buffer.copy(tmp)
        data.copy(tmp, buffer.length)
        buffer = tmp;

        try { 
            while (buffer.length) {
                if (!code) { 
                    code = buffer[0];
                    buffer = buffer.slice(1);
                }

                var response = false;
                var meta = metaMap[code];

                if (meta) {
                    result = struct.decode(meta.format, buffer);
                    if (code == 0x0d) {
                        logPosition && console.log(buffer);
                    }

                    if (!meta.ignore) {
                        console.log('decoded 0x' + code.toString(16), meta.name, result.data);
                    }
                    code = null;
                    buffer = result.remaining;
                    if (meta.handler) {
                        meta.handler(result.data);
                    }
                } else {
                    console.log('unknown code', '0x'+code.toString(16));
                    break;
                }
            }
        } catch(e) { 
            if (e.message !== 'oob') {
                console.log('error on code', code && '0x'+code.toString(16), e)
                throw e;
            }
            // skipping
        }
    }

    var onTime = function() {
    }

    var onHealth = function(data) {
        var health = data[0];
        var encoded = struct.encode('b', [0x09]);
        client.write(encoded);

    }

    var onChunk = function() {
        logPosition && console.log('gotchunk');
    }

    var onLogin = function(data) {
        console.log('onlogin',data)
    }

    var onHandshake = function(data) {
        console.log('handshake',data)
        client.write(struct.encode('bisslb', [1, 9, "OMG", "Password", 0, 0]))
    }

    var serverposition = null;
    var clientposition = [0,0,0,0,0,0];
    var previousposition = null;

    var hasMoved = function() {
        return !(previousposition &&
                 previousposition[0] == serverposition[0] &&
                 previousposition[1] == serverposition[1] &&
                 previousposition[2] == serverposition[2])
    }

    var onPosition = function(data) {
        logPosition && console.log('got position from server', data);
        if (!serverposition) {
            setInterval(move, 1000);
        }
        previousposition = serverposition;
        serverposition = data;
        move();
        if (!hasMoved()) {
            dig();
        }

    }

    var dig = function() {
        var params = [
            0x0E, 
            0, 
            parseInt(clientposition[0]), 
            parseInt(clientposition[1]-1), 
            parseInt(clientposition[3]), 
            3
        ]
        var encoded = struct.encode('bbibib', params);
        console.log('dig', params); 
        //console.log(encoded);
        client.write(encoded);
    }

    var move = function() {
        if (serverposition) {
            var x = serverposition[0];
            var y = serverposition[2];
            var stance = serverposition[1];
            var z = serverposition[3];
            var yaw = serverposition[4];
            var pitch = serverposition[5];
            var ground = serverposition[6];

            clientposition = [x,y,stance,z,yaw,pitch,ground];
             var encoded = struct.encode('ddddffb', clientposition);
            serverposition = null;
            logPosition && console.log('adjust', clientposition);
            logPosition && console.log(encoded)
        } else { 
            var rand = Math.random()
            clientposition[1] -= rand 
            clientposition[2] -= rand 
            console.log('move down');
        }
        
        var pos = [0x0D].concat(clientposition); 
        var encoded = struct.encode('bddddffb', pos);
        client.write(encoded);
    }
    
    var metaMap = {
        0x68: {format: 'bp', name: 'window items'},
        0x67: {format: 'bSI', name: 'set slot'},
        0x3c: {format: 'dddfR', name: 'explosion'},
        0x35: {format: 'ibibb', name: 'block change'},
        0x34: {format: 'iiX', ignore: true, name: 'multi block change'},
        0x33: {format: 'iSibbbC', ignore: true, name: 'map chunk', handler: onChunk},
        0x32: {format: 'iib', ignore: true, name: 'pre-chunk'},
        0x28: {format: 'im', name: 'entity metadata'},
        0x26: {format: 'ib', name: 'entity status', name: 'entity status'},
        0x22: {format: 'iiiibb', name: 'teleport'},
        0x21: {format: 'ibbbbb', ignore:true, name: 'entity look and move'},
        0x1f: {format: 'ibbb', ignore: true, name: 'entity relative move'},
        0x1d: {format: 'i', name: 'destroy '},
        0x1c: {format: 'iSSS', ignore: true , name: 'mob velocity'},
        0x18: {format: 'ibiiibbm', name: 'mobinfo'},
        0x17: {format: 'ibiii', name: 'add object/vehicle'},
        0x16: {format: 'ii', name: 'collect item'},
        0x15: {format: 'iSbSiiibbb', name: 'pickup spawn'},
        0x14: {format: 'isiiibbS', name: 'named spawn'},
        0x12: {format: 'ib', name: 'Animate', ignore:true},
        0x0D: {format: 'ddddffb', ignore: true, handler: onPosition, name: 'position and look'},
        //0x09: {format: '', name: 'respawn'},
        0x08: {format: 'S', name: 'update health', handler: onHealth},
        0x06: {format: 'iii', name: 'spawn position'},
        0x05: {format: 'iSSS', name: 'entity equipment'},
        0x04: {format: 'l', ignore: true, name: 'time', handler: onTime},
        0x03: {format: 's', handler: console.log},
        0x02: {format: 's', handler: onHandshake},
        0x01: {format: 'isslb', handler: onLogin}
    }

    client.on('connect', function() {
        client.write(struct.encode('bs', [0x02,"Player"]))
    });

    client.on('data', onData); 

}

