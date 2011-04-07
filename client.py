#!/usr/bin/env python

import socket
import struct

def join(conn):
    handshake = struct.pack('!B', 2)
    conn.send(handshake)
    handshake = struct.pack('!B7p', 0, "Player")
    conn.send(handshake)


    result = conn.recv(1024)
    print struct.unpack('!B', result)
    result = conn.recv(1024)

conn = socket.create_connection(("192.168.0.199", 25565))
join(conn)
