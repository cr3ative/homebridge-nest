const NestConnection = require('./lib/nest-connection.js');
const inherits = require('util').inherits;
const Promise = require('bluebird');

let Service, Characteristic, Accessory, uuid;
let ThermostatAccessory, ProtectAccessory, CamAccessory; // DeviceAccessory,
let Away, EcoMode, FanTimerActive, FanTimerDuration, HasLeaf, ManualTestActive, SunlightCorrectionEnabled, SunlightCorrectionActive, UsingEmergencyHeat;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;

    // Define custom characteristics

    /*
   * Characteristic "Away"
   */
    Away = function () {
        Characteristic.call(this, 'Away', 'D6D47D29-4638-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(Away, Characteristic);

    /*
   * Characteristic "EcoMode"
   */
    EcoMode = function () {
        Characteristic.call(this, 'Eco Mode', 'D6D47D29-4639-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(EcoMode, Characteristic);

    /*
   * Characteristic "FanTimerActive"
   */
    FanTimerActive = function () {
        Characteristic.call(this, 'Fan Timer Active', 'D6D47D29-4640-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(FanTimerActive, Characteristic);

    /*
   * Characteristic "FanTimerDuration"
   */
    FanTimerDuration = function () {
        Characteristic.call(this, 'Fan Timer Duration', 'D6D47D29-4641-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.MINUTES,
            maxValue: 60,
            minValue: 15,
            minStep: 15,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(FanTimerDuration, Characteristic);

    /*
   * Characteristic "HasLeaf"
   */
    HasLeaf = function () {
        Characteristic.call(this, 'Has Leaf', 'D6D47D29-4642-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(HasLeaf, Characteristic);

    /*
   * Characteristic "ManualTestActive"
   */
    ManualTestActive = function () {
        Characteristic.call(this, 'Manual Test Active', 'D6D47D29-4643-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(ManualTestActive, Characteristic);

    /*
   * Characteristic "SunlightCorrectionEnabled"
   */
    SunlightCorrectionEnabled = function () {
        Characteristic.call(this, 'Sunlight Correction Enabled', 'D6D47D29-4644-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(SunlightCorrectionEnabled, Characteristic);

    /*
   * Characteristic "SunlightCorrectionActive"
   */
    SunlightCorrectionActive = function () {
        Characteristic.call(this, 'Sunlight Correction Active', 'D6D47D29-4645-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(SunlightCorrectionActive, Characteristic);

    /*
   * Characteristic "UsingEmergencyHeat"
   */
    UsingEmergencyHeat = function () {
        Characteristic.call(this, 'Using Emergency Heat', 'D6D47D29-4646-4F44-B53C-D84015DAEBDB');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(UsingEmergencyHeat, Characteristic);

    const exportedTypes = {
        Accessory: Accessory,
        Service: Service,
        Characteristic: Characteristic,
        uuid: uuid,
        Away: Away,
        EcoMode: EcoMode,
        FanTimerActive: FanTimerActive,
        FanTimerDuration: FanTimerDuration,
        HasLeaf: HasLeaf,
        ManualTestActive: ManualTestActive,
        SunlightCorrectionEnabled: SunlightCorrectionEnabled,
        SunlightCorrectionActive: SunlightCorrectionActive,
        UsingEmergencyHeat: UsingEmergencyHeat
    };

    // DeviceAccessory =
    require('./lib/nest-device-accessory.js')(exportedTypes); // eslint-disable-line global-require
    ThermostatAccessory = require('./lib/nest-thermostat-accessory.js')(exportedTypes); // eslint-disable-line global-require
    ProtectAccessory = require('./lib/nest-protect-accessory.js')(exportedTypes); // eslint-disable-line global-require
    CamAccessory = require('./lib/nest-cam-accessory.js')(exportedTypes); // eslint-disable-line global-require

    homebridge.registerPlatform('homebridge-nest', 'Nest', NestPlatform);
};

function NestPlatform(log, config) {
    // auth info
    this.config = config;

    this.log = log;
    this.accessoryLookup = {};
}

const setupConnection = function(config, log) {
    return new Promise(function (resolve, reject) {
        const email = config.email;
        const password = config.password;
        const pin = config.pin;
        const token = '';

        let err;
        if (!email || !password) {
            err = 'You did not specify your Nest app {\'email\',\'password\'} in config.json';
        }
        if (err) {
            reject(new Error(err));
            return;
        }

        const conn = new NestConnection(token, log);
        if (token) {
            resolve(conn);
        } else {
            conn.auth(email, password, pin)
                .then(() => {
                    resolve(conn);
                })
                .catch(function(authError){
                    if (log) {
                        if (authError.code == 400) {
                            log.warn('Auth failed: email/password is not valid. Check you are using the correct email/password for your Nest account');
                        } else if (authError.code == 429) {
                            log.warn('Auth failed: rate limit exceeded. Please try again in 60 minutes');
                        } else if (authError.code == '2fa_error') {
                            log.warn('Auth failed: 2FA PIN was rejected');
                        } else {
                            log.warn('Auth failed: could not connect to Nest service. Check your Internet connection');
                        }
                    }
                    reject(authError);
                });
        }
    });
};

NestPlatform.prototype = {
    shouldEnableFeature: function (key) {
        return !this.config.disable || !this.config.disable.includes(key);
    },
    accessories: function (callback) {
        this.log('Fetching Nest devices.');

        const that = this;

        const generateAccessories = function(data) {
            const foundAccessories = [];

            const loadDevices = function(DeviceType) {
                const devices = (data.devices && data.devices[DeviceType.deviceGroup]) || {};
                for (const deviceId of Object.keys(devices)) {
                    const device = devices[deviceId];
                    const structureId = device.structure_id;
                    if (this.config.structureId && this.config.structureId !== structureId) {
                        this.log('Skipping device ' + deviceId + ' because it is not in the required structure. Has ' + structureId + ', looking for ' + this.config.structureId + '.');
                        continue;
                    }
                    const structure = data.structures[structureId];
                    const accessory = new DeviceType(this.conn, this.log, device, structure, this);
                    this.accessoryLookup[deviceId] = accessory;
                    foundAccessories.push(accessory);
                }
            }.bind(this);

            loadDevices(ThermostatAccessory);
            loadDevices(ProtectAccessory);
            loadDevices(CamAccessory);

            return foundAccessories;
        }.bind(this);

        const updateAccessories = function(data, accList) {
            accList.map(function(acc) {
                const device = data.devices[acc.deviceGroup][acc.deviceId];
                const structureId = device.structure_id;
                const structure = data.structures[structureId];
                acc.updateData(device, structure);
            });
        };

        const handleUpdates = function(data){
            updateAccessories(data, that.accessoryLookup);
        };
        setupConnection(this.config, this.log)
            .then(function(conn){
                that.conn = conn;
                return that.conn.subscribe(handleUpdates);
            })
            .then(function(data) {
                that.accessoryLookup = generateAccessories(data);
                if (callback) {
                    const copy = Array.from(that.accessoryLookup);
                    callback(copy);
                }
            })
            .catch(function(err) {
                that.log.error(err);
                if (callback) {
                    callback([]);
                }
            });
    }
};
