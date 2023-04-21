import time
import RPi.GPIO as GPIO
import serial
import DataFramer.Framing as framing

class LoRa():
    M0 = 22
    M1 = 27

    SX126X_UART_BAUDRATE_1200 = 0x00
    SX126X_UART_BAUDRATE_2400 = 0x20
    SX126X_UART_BAUDRATE_4800 = 0x40
    SX126X_UART_BAUDRATE_9600 = 0x60
    SX126X_UART_BAUDRATE_19200 = 0x80
    SX126X_UART_BAUDRATE_38400 = 0xA0
    SX126X_UART_BAUDRATE_57600 = 0xC0
    SX126X_UART_BAUDRATE_115200 = 0xE0

    SX126X_AIR_SPEED_300bps = 0x00
    SX126X_AIR_SPEED_1200bps = 0x01
    SX126X_AIR_SPEED_2400bps = 0x02
    SX126X_AIR_SPEED_4800bps = 0x03
    SX126X_AIR_SPEED_9600bps = 0x04
    SX126X_AIR_SPEED_19200bps = 0x05
    SX126X_AIR_SPEED_38400bps = 0x06
    SX126X_AIR_SPEED_62500bps = 0x07

    SX126X_PACKAGE_SIZE_240_BYTE = 0x00
    SX126X_PACKAGE_SIZE_128_BYTE = 0x40
    SX126X_PACKAGE_SIZE_64_BYTE = 0x80
    SX126X_PACKAGE_SIZE_32_BYTE = 0xC0

    SX126X_Power_22dBm = 0x00
    SX126X_Power_17dBm = 0x01
    SX126X_Power_13dBm = 0x02
    SX126X_Power_10dBm = 0x03

    def __init__(self,my_address,frequency = 868,send_to = None, locked = False, port='/dev/ttyS0',baudrate = 9600,parity=serial.PARITY_NONE,stopbits=serial.STOPBITS_ONE,bytesize=serial.EIGHTBITS,timeout=1):
        #LoRa Settings
        self.my_address = my_address
        self.freq = frequency
        self.send_to = send_to
        self.locked = locked
        self.cfg_reg = [0xC0,0x00,0x09,0x00,0x00,0x00,0x62,0x00,0x17,0x00,0x00,0x00]
        self.message_id_list = []

        #Serial Settings
        self.port = port
        self.baudrate = baudrate
        self.parity = parity
        self.stopbits = stopbits
        self.bytesize = bytesize
        self.timeout = timeout
        if frequency > 850:
            self.cfg_reg[8] = frequency - 850
        elif frequency >410:
            self.cfg_reg[8] = frequency - 410
        self.cfg_reg[8] = frequency - 850

        self.all_channel = set()
        self.all_channel.add(self.my_address)
        self.shortest_path = []

        # Initial the GPIO for M0 and M1 Pin
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO.setup(self.M0,GPIO.OUT)
        GPIO.setup(self.M1,GPIO.OUT)
        GPIO.output(self.M0,GPIO.LOW)
        GPIO.output(self.M1,GPIO.HIGH)
        self.write_receive = serial.Serial(port=self.port, baudrate=self.baudrate, parity=self.parity, stopbits=self.stopbits, bytesize=self.bytesize, timeout=self.timeout)
        self.write_receive.flushInput()
        time.sleep(0.2)
        self.settings()
        time.sleep(2)
        GPIO.output(self.M0,GPIO.LOW)
        GPIO.output(self.M1,GPIO.LOW)
        time.sleep(0.1)

    def settings(self):
        self.write_receive.write(bytes(self.cfg_reg))       

    def send(self, data, print_bool = False):
        data = framing.framer(data)
        self.locked = True
        self.write_receive.write(data+b'\n')
        self.locked = False
        if print_bool:
            print(str(data)+": was sent")
        else:
            print("I sent something!")

    def receive(self):
        data = None
        return_array = []
        while data == None:
            while self.locked == True:
                pass
            data = self.write_receive.readline()
            if data == b'':
                continue
            data_array = framing.deframer(data)
            for current_message in data_array:
                if(current_message == b''):
                    continue
                else:
                    return_array.append(current_message)
            return return_array
        return []