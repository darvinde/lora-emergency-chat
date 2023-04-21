def framer(message):
    frame = b'\x00\xff\xe6'
    return frame + message + frame

def deframer(bytes):
    returnarray = []
    while bytes.find(b'\x00\xff\xe6') != -1:
        bytes = bytes[bytes.find(b'\x00\xff\xe6')+3:]
        next_byte = bytes
        bytes = bytes[:bytes.find(b'\x00\xff\xe6')]
        if bytes != b'':
            returnarray.append(bytes)
        bytes = next_byte
        
    return returnarray