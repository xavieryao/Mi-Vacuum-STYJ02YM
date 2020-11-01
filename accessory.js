const axios = require('axios');

let hap;
let Service, Characteristic;


class MiVacuum {
    constructor(log, config, api) {
        this.status = {
            run_state: 5,
            mode: 0,
            err_state: 2103,
            battery_life: 85,
            box_type: 3,
            mop_type: 1,
            s_time: 0,
            s_area: 0,
            suction_grade: 1,
            water_grade: 11,
            remember_map: 1,
            has_map: 1,
            is_mop: 1,
            has_new_map: 0
        }; // default status
        this.stateLastRefreshed = 0;


        this.log = log;
        this.name = config.name;
        this.server = config.server;
        log.info('vacuum relay server', this.server);

        // FIXME: change to blocking
        this.refreshStatus();

        this.registerServices();
        log.info("Robot finished initializing!");
    }

    registerServices() {
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Xiaomi")
            .setCharacteristic(hap.Characteristic.Model, "Mi Robot Vacuum-Mop P")
            .setCharacteristic(hap.Characteristic.FirmwareRevision, "3.5.3_0017");

        this.registerBatteryService();
        this.registerFanService();
        this.registerSwitchService();
    }

    registerFanService() {
        this.mainService = new Service.Fan();
        this.mainService.setCharacteristic(Characteristic.Name, "Vacuum");
        this.mainService.getCharacteristic(Characteristic.On)
            .on('get', (callback) => {
                this.refreshStatus().then(status => {
                    let cleaning = 1 ? (status.run_state == 3 || status.run_state == 4 || status.run_state == 6) : 0;
                    this.log.info("cleaning status", cleaning);
                    callback(null, cleaning);
                });
            })
            .on('set', (value, callback) => {
                this.refreshStatus().then(status => {
                    let cleaning = 1 ? (status.run_state == 3 || status.run_state == 4 || status.run_state == 6) : 0;
                    if (cleaning == value) {
                        callback(null);
                    } else if (cleaning) {
                        this.log.info("pause cleaning.");
                        return axios.get(`${this.server}/pause`);
                    } else {
                        this.log.info("start cleaning.");
                        return axios.get(`${this.server}/start`);
                    }
                }).then(resp => {
                    if (resp && resp.status == 200) {
                        callback(null);
                    }
                });
            });
        
        // suction grade
        this.mainService.getCharacteristic(Characteristic.RotationSpeed)
            .on('get', (callback) => {
                this.refreshStatus().then(status => {
                    callback(null, (status.suction_grade + 1) * 25);
                });
            })
            .on('set', (value, callback) => {
                if (value == 100) {value = 99}
                let grade = Math.ceil(value / 25);
                axios.get(`${this.server}/fanspeed/${grade}`)
                    .then(resp => {
                        if (resp == 200) callback(null);
                    })
            });
    }

    registerSwitchService() {
        this.homeSwitchService = new Service.Switch();
        this.homeSwitchService.subtype = "Home";
        this.homeSwitchService.setCharacteristic(Characteristic.Name, "Docking");
        this.homeSwitchService.getCharacteristic(Characteristic.On)
            .on('get', (callback) => {
                this.refreshStatus().then(status => {
                    let returning = 1 ? status.run_state == 4 : 0;
                    this.log.info("returning status", returning);
                    callback(null, returning);
                });
            })
            .on('set', (value, callback) => {
                this.refreshStatus().then(status => {
                    let returning = 1 ? status.run_state == 4 : 0;
                    if (returning == value) {
                        callback(null);
                    } else {
                        this.log.info("start docking.");
                        return axios.get(`${this.server}/home`);
                    }
                }).then(resp => {
                    if (resp.status == 200) {
                        callback(null);
                    }
                });
            });
    }

    registerBatteryService() {
        this.batteryService = new Service.BatteryService();
        this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on("get", (callback) => {
                this.refreshStatus().then(status => {
                    callback(null, status.battery_life);
                });
            });
        this.batteryService.getCharacteristic(Characteristic.ChargingState)
            .on("get", (callback) => {
                this.refreshStatus().then(status => {
                    let charging = 1 ? status.run_state == 5 : 0;
                    callback(null, charging);
                });
            });
        this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on("get", (callback) => {
                this.refreshStatus().then(status => {
                    let low = 1 ? status.battery_life < 10 : 0;
                    callback(null, low);
                });
            });
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify() {
        this.log("Identify!");
    }
    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices() {
        return [
            this.informationService,
            this.batteryService,
            this.mainService,
            this.homeSwitchService
        ];
    }

    refreshStatus() {
        return new Promise((resolve, reject) => {
            if (Date.now() - this.stateLastRefreshed > 1000) {
                this.stateLastRefreshed = Date.now()
                axios.get(`${this.server}/status`).then(resp => {
                    if (resp.status == 200) {
                        this.status = resp.data;
                        this.log.info("Vacuum status update", this.status);
                        resolve(this.status);
                    }
                }).catch(reject);
            } else {
                resolve(this.status);
            }
        })
    }
}

module.exports = (api) => {
    hap = api.hap;
    Service = hap.Service;
    Characteristic = hap.Characteristic;
    api.registerAccessory("Mi Robot Vacuum-Mop P", MiVacuum);
};