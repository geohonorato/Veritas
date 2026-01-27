const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');

class SerialService extends EventEmitter {
    constructor() {
        super();
        this.port = null;
        this.parser = null;
        this.enrollmentHandler = null;
    }

    // Removed setMainWindow - functionality replaced by events

    listPorts() {
        return SerialPort.list();
    }

    isOpen() {
        return this.port && this.port.isOpen;
    }

    connect(path) {
        return new Promise((resolve, reject) => {
            if (!path) return resolve(true);

            if (this.port && this.port.isOpen) {
                this.port.close((err) => {
                    if (err) console.error('Error closing old port:', err);
                    this._openPort(path, resolve, reject);
                });
            } else {
                this._openPort(path, resolve, reject);
            }
        });
    }

    _openPort(serialPath, resolve, reject) {
        this.port = new SerialPort({ path: serialPath, baudRate: 115200, autoOpen: false });
        this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

        this.port.on('open', () => {
            console.log(`Port ${serialPath} opened.`);
            this.emit('connected');
            resolve(true);
        });

        this.port.on('error', (err) => {
            console.error(`Error on port ${serialPath}:`, err);
            reject(err);
        });

        this.parser.on('data', (line) => this._handleData(line));

        this.port.open((err) => {
            if (err) {
                reject(err);
            }
        });
    }

    _handleData(line) {
        this.emit('data', line);
    }

    setOnDataCallback(callback) {
        this.onDataCallback = callback;
    }

    write(data) {
        if (this.port && this.port.isOpen) {
            this.port.write(data);
        } else {
            console.warn("Serial port not open, cannot write:", data);
        }
    }

    // High level commands
    setTime() {
        if (!this.isOpen()) throw new Error('Port not open');
        const now = new Date();
        const command = JSON.stringify({
            command: 'SET_TIME',
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds()
        });
        this.write(command + '\n');
    }

    setBuzzer(enabled) {
        if (this.isOpen()) {
            const command = JSON.stringify({ command: 'SET_BUZZER', enabled: enabled });
            this.write(command + '\n');
        }
    }

    deleteUser(userId) {
        if (!this.isOpen()) throw new Error('Port not open');
        const command = JSON.stringify({ command: 'DELETE_ID', id: userId });
        this.write(command + '\n');
        // Logic to wait for response usually handled in main controller or promise wrapper
        // Ideally this returns a promise that resolves when 'success' is received.
        // However, to keep it simple during refactor, we expose write and let main handle logic?
        // No, services should be self-contained.
    }
}

module.exports = new SerialService();
