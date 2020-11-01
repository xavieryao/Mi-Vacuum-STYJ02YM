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
        this.state_last_refreshed = 0;


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
        this.registerBatteryService();

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Xiaomi")
            .setCharacteristic(hap.Characteristic.Model, "Mi Robot Vacuum-Mop P")
            .setCharacteristic(hap.Characteristic.FirmwareRevision, "3.5.3_0017");
    }
    
    registerBatteryService() {
        // battery
        this.batteryService = new Service.BatteryService();
        this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on("get", (callback) => {
                this.refreshStatus().then(status => {
                    this.log.info("battery life", status.battery_life);
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
        ];
    }

    refreshStatus() {
        return new Promise((resolve, reject) => {
            if (Date.now() - this.state_last_refreshed > 2000) {
                this.state_last_refreshed = Date.now()
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