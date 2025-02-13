/**
 * Created by Adrian Cable on 7/16/19.
 */

const Promise = require('bluebird');
const rp = require('request-promise');
const Prompt = require('prompt-promise');

'use strict';

module.exports = Connection;

let API_PENDING = 0;

// Amount of time to run the fan when accessory is turned on
const FAN_DURATION_MINUTES = 15;

// Interval between Nest status update polls
const API_POLL_SECONDS = 5;

// We want to look like a browser
const USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36';

function Connection(token, log) {
    this.token = token;
    this.log = function(info) {
        log.info(info);
    };
    this.debug = function(info) {
        log.debug(info);
    };
    this.error = function(info) {
        log.error(info);
    };
}

Connection.prototype.auth = function(email, password, forcePIN) {
    API_PENDING++;
    return new Promise((resolve, reject) => {
        rp({
            method: 'POST',
            uri: 'https://home.nest.com/session',
            headers: {
                'Authorization': 'Basic',
                'User-Agent': USER_AGENT_STRING
            },
            body: {
                email: email,
                password: password
            },
            json: true
        }).then(body => {
            this.token = body.access_token;
            this.transport_url = body.urls.transport_url;
            this.userid = body.userid;
            this.loggedin_email = email;
            this.loggedin_password = password;
            resolve(this.token);
        }).catch(error => {
            if (error.statusCode == 401) {
                // 2FA required
                let getPIN;

                this.log('Your Nest account has 2-factor authentication enabled.');
                if (forcePIN) {
                    this.log('Using PIN ' + forcePIN + ' from config.json.');
                    this.log('If authentication fails, check this matches the 6-digit PIN sent to your phone number ending ' + error.response.body.truncated_phone_number + '.');
                    getPIN = Promise.resolve(forcePIN);
                } else {
                    this.log('Please enter the 6-digit PIN sent to your phone number ending ' + error.response.body.truncated_phone_number + '.');
                    getPIN = Prompt('PIN: ');
                }
                getPIN.then(pin => {
                    return rp({
                        method: 'POST',
                        uri: 'https://home.nest.com/api/0.1/2fa/verify_pin',
                        body: {
                            pin: pin,
                            '2fa_token': error.response.body['2fa_token']
                        },
                        json: true
                    });
                }).then(result => {
                    return rp({
                        method: 'GET',
                        uri: 'https://home.nest.com/session',
                        headers: {
                            'Authorization': 'Basic ' + result.access_token,
                            'User-Agent': USER_AGENT_STRING
                        },
                        json: true
                    });
                }).then(body => {
                    this.token = body.access_token;
                    this.transport_url = body.urls.transport_url;
                    this.userid = body.userid;
                    this.loggedin_email = email;
                    this.loggedin_password = password;
                    resolve(this.token);
                }).catch(() => {
                    reject({ code: '2fa_error' });
                });
            } else {
                reject({ code: error.statusCode });
            }
        }).finally(() => API_PENDING--);
    });
};

Connection.prototype.updateData = function() {
    if (API_PENDING) {
    // Don't get a data update if we are in the middle of pushing updated settings to the device
        Promise.resolve(null);
    }

    let data = {};
        
    return rp({
        method: 'GET',
        uri: this.transport_url +'/v2/mobile/user.' + this.userid,
        headers: {
            'User-Agent': USER_AGENT_STRING,
            'Authorization': 'Basic ' + this.token,
            'X-nl-user-id': this.userid,
            'X-nl-protocol-version': 1
        },
        json: true
    })
        .then(body => {
            data.devices = {};
            data.devices['thermostats'] = {};
            data.devices['smoke_co_alarms'] = {};
                  
            let structures = body.structure || {};
            let shared = body.shared || {};
            let topaz = body.topaz || {};
            let device = body.device || {};
        
            for (let i = 0; i < Object.keys(structures).length; i++) {
                let structureId = Object.keys(structures)[i];
                let thisStructure = structures[structureId];
            
                thisStructure.structure_id = structureId;
                thisStructure.away = thisStructure.away ? 'away' : 'home';
            
                let swarm = thisStructure.swarm;
                swarm.map(unit => unit.split('.')).forEach(unit => {
                    let deviceType = unit[0];
                    let deviceId = unit[1];
                
                    if (deviceType == 'device') {
                        // Detected thermostat
            
                        data.devices['thermostats'][deviceId] = device[deviceId];
                        let thisDevice = data.devices['thermostats'][deviceId];
                    
                        for (let j = 0; j < Object.keys(shared[deviceId]).length; j++) {
                            let sKey = Object.keys(shared[deviceId])[j];
                            thisDevice[sKey] = shared[deviceId][sKey];
                        }
                    
                        thisDevice.device_id = deviceId;
                        thisDevice.structure_id = structureId;
                        thisDevice.name = thisDevice.name || 'Nest Thermostat';
                        thisDevice.fan_timer_active = thisDevice.fan_timer_timeout > 0;
                        thisDevice.hvac_mode = (thisDevice.eco.mode == 'manual-eco' || thisDevice.eco.mode == 'auto-eco') ? 'eco' : (thisDevice.target_temperature_type == 'range' ? 'heat-cool' : thisDevice.target_temperature_type.toLowerCase());
                        thisDevice.previous_hvac_mode = 'eco-off';
                        thisDevice.humidity = thisDevice.current_humidity;
                        thisDevice.software_version = thisDevice.current_version;
                        thisDevice.hvac_state = (thisDevice.can_heat && thisDevice.hvac_heater_state) ? 'heating' : (thisDevice.can_cool && thisDevice.hvac_ac_state ? 'cooling' : 'off');
                    
                        temperatureUnitMirror(thisDevice, 'current_temperature', 'ambient_temperature');
                        temperatureUnitMirror(thisDevice, 'target_temperature');
                        temperatureUnitMirror(thisDevice, 'target_temperature_high');
                        temperatureUnitMirror(thisDevice, 'target_temperature_low');
                        temperatureUnitMirror(thisDevice, 'eco_temperature_high');
                        temperatureUnitMirror(thisDevice, 'eco_temperature_low');
                        temperatureUnitMirror(thisDevice, 'away_temperature_high');
                        temperatureUnitMirror(thisDevice, 'away_temperature_low');
                    } else if (deviceType == 'topaz') {
                        // Detected Nest Protect
                    
                        data.devices['smoke_co_alarms'][deviceId] = topaz[deviceId];
                        let thisDevice = data.devices['smoke_co_alarms'][deviceId];
                        thisDevice.device_id = deviceId;
                        thisDevice.name = thisDevice.description || 'Nest Protect';
                        thisDevice.smoke_alarm_state = (thisDevice.smoke_status == 0) ? 'ok' : 'emergency';
                        thisDevice.co_alarm_state = (thisDevice.co_status == 0) ? 'ok' : 'emergency';
                        thisDevice.battery_health = (thisDevice.battery_health_state == 0) ? 'ok' : 'low';
                        thisDevice.is_online = thisDevice.component_wifi_test_passed;
                    }
                });
            }
        
            data.structures = structures;
            return data;
        }).catch(error => {
            this.log('Nest API call to update status returned an error: ' + error.statusCode);
        });
};

Connection.prototype.dataTimerLoop = function(resolve, handler) {
    var notify = resolve || handler;

    this.updateData().then(data => {
        if (data) {
            notify(data);
        }
    }).catch(error => {
        console.log('Nest_API_error', error);
        if (error.statusCode == 401 || error.statusCode == 403) {
            // Token has probably expired - re-authenticate
            this.log('Reauthenticating on Nest service ...');
            this.auth(this.loggedin_email, this.loggedin_password);
        }
    }).finally(() => {
        setTimeout(() => this.dataTimerLoop(null, handler), API_POLL_SECONDS * 1000);
    });
};

Connection.prototype.subscribe = function(handler) {
    return new Promise(resolve => {
        this.dataTimerLoop(resolve, handler);
    });
};

Connection.prototype.update = function(path, data) {
    let body, url, serviceType;
    
    let splitPath = path.split('/');
    if (splitPath[0] == 'structures') {
        serviceType = 'structure';
        
        if (splitPath[2] == 'away') {
            body = { away: data == 'away', away_timestamp: getUnixTime(), away_setter: 0 };
        }
    } else if (splitPath[0] == 'devices') {
        serviceType = 'shared';
        
        if (splitPath[1] == 'thermostats') {
            if (splitPath[3] == 'hvac_mode') {
                if (['eco', 'eco-off'].includes(data)) {
                    serviceType = 'device';
                    body = { eco: { mode: data == 'eco' ? 'manual-eco' : 'schedule' }};
                } else if (data == 'heat-cool') {
                    body = { target_temperature_type: 'range' };
                } else if (['heat', 'cool', 'off'].includes(data)) {
                    body = { target_temperature_type: data };
                }
            } else if (splitPath[3] == 'temperature_scale' ) {
                serviceType = 'device';
                body = { temperature_scale: data };
            } else if (splitPath[3] == 'target_temperature_f' ) {
                body = { target_temperature: fahrenheitToCelsius(data) };
            } else if (splitPath[3] == 'target_temperature_c' ) {
                body = { target_temperature: Number(data) };
            } else if (splitPath[3] == 'fan_timer_active' ) {
                serviceType = 'device';
                body = { fan_timer_timeout: data ? getUnixTime() + (FAN_DURATION_MINUTES * 60) : 0 };
            }
        }
    }
    
    if (serviceType && body) {
        url = this.transport_url + '/v2/put/' + serviceType + '.' + splitPath[serviceType == 'structure' ? 1 : 2];
        API_PENDING++;
        return Promise.resolve(rp({
            method: 'POST',
            uri: url,
            headers: {
                'User-Agent': USER_AGENT_STRING,
                'Authorization': 'Basic ' + this.token,
                'X-nl-protocol-version': 1
            },
            body: body,
            json: true
        }))
            .catch(error => {
                this.log('Nest API call to change device settings returned an error: ' + error.statusCode);
            })
            .finally(() => API_PENDING--);
    } else {
        return Promise.reject(new Error('not_supported'));
    }
};

function celsiusToFahrenheit(temperature) {
    return (temperature * 1.8) + 32;
}

function fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
}

function getUnixTime() {
    return Math.floor(Date.now() / 1000);
}

function temperatureUnitMirror(obj, apiKey, wwnKey) {
    if (!wwnKey) {
        wwnKey = apiKey;
    }
    if (obj[apiKey]) {
        obj[wwnKey + '_c'] = obj[apiKey];
        obj[wwnKey + '_f'] = celsiusToFahrenheit(obj[apiKey]);
    }
}

