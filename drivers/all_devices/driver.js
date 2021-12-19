/* eslint-disable camelcase */
/* jslint node: true */

'use strict';

const Driver = require('../Driver');

const IoValveHeating = require('../io_valve_heating/device');
const Siren = require('../siren/device');
const ColorTemperatureLightController = require('../color_temperature_light/device');
const DimmableLightController = require('../dimmable_light/device');
const WindowHandle = require('../enocean_window_handle/device');
const HeaterOnOff = require('../heater_on_off/device');
const Hub = require('../hub/device');
const AtlanticZoneController = require('../io_atlantic_apc_zone_controller/device');
const AtlanticDHWBoiler = require('../io_atlantic_dhw_boiler/device');
const WaterBoilerProduction = require('../io_atlantic_dhw_production/device');
const WaterTank = require('../io_atlantic_dhw_tank/device');
const ElectricHeater = require('../io_atlantic_electric_heater/device');
const HotColdZone = require('../io_atlantic_hot_cold_zone/device');
const DoorLock = require('../io_door_lock/device');
const EnergySensor = require('../io_energy_sensor/device');
const ExteriorVenetianBlind = require('../io_exterior_venetian_blind/device');
const GarageDoorIOd = require('../io_garage_door/device');
const GarageDoorPartialIOd = require('../io_garage_door_partial/device');
const HorizontalAwning = require('../io_horizontal_awning/device');
const LightSensor = require('../io_light_sensor/device');
const MotionDetector = require('../io_occupancy_detector/device');
const io_open_close_remote = require('../io_open_close_remote/device');
const OpeningDetector = require('../io_opening_detector/device');
const Pergola = require('../io_pergola/device');
const RollerShutter = require('../io_roller_shutter/device');
const RollerShutterQuiet = require('../io_roller_shutter_quiet/device');
const SlidingGate = require('../io_sliding_gate/device');
const TemperatureSensor = require('../io_temperature_sensor/device');
const VeluxInteriorBlind = require('../io_velux_interior_blind/device');
const VeluxRollerShutter = require('../io_velux_roller_shutter/device');
const RoofWindow = require('../io_velux_roof_window/device');
const VerticalExteriorBlind = require('../io_vertical_exterior_blind/device');
const VerticalInteriorBlindGenericIO = require('../io_vertical_interior_blind/device');
const key_go_remote = require('../key_go_remote/device');
const myFoxLightController = require('../myfox_light_controller/device');
const OnOffLightController = require('../on_off_switch/device');
const OneAlarm = require('../one_alarm/device');
const PilotWireProgrammer = require('../pilot_wire_programmer/device');
const WaterSensor = require('../rtds_water_sensor/device');
const rtsGateOpener = require('../rts_gate_opener/device');
const HorizontalAwningRTS = require('../rts_horizontal_awning/device');
const InteriorBlind = require('../rts_interior_blind/device');
const InteriorCurtain = require('../rts_interior_curtain/device');
const InteriorVenetianBlind = require('../rts_interior_venetian_blind/device');
const OpenClose = require('../rts_open_close/device');
const SmokeDetector = require('../smoke_detector/device');
const TahomaAlarm = require('../tahoma_alarm/device');
const two_button_on_off = require('../two_button_on_off_light/device');
const WhiteTemperatureLightController = require('../white_temperature_light/device');

const somfyMap = {
    'io:HeatingValveIOComponent': { id: 'io_valve_heating', class: IoValveHeating },
    'io:SomfyIndoorSimpleSirenIOComponent': { id: 'siren', class: Siren },
    'hue:GenericExtendedColorLightHUEComponent': { id: 'color_temperature_light', class: ColorTemperatureLightController },
    'hue:ExtendedColorLightCandleHUEComponent': { id: 'color_temperature_light', class: ColorTemperatureLightController },
    'hue:LightStripsPlusHUEComponent': { id: 'color_temperature_light', class: ColorTemperatureLightController },
    'io:DimmableLightIOComponent': { id: 'dimmable_light', class: DimmableLightController },
    'hue:HueLuxHUEComponent': { id: 'dimmable_light', class: DimmableLightController },
    'hue:GenericDimmableLightHUEComponent': { id: 'dimmable_light', class: DimmableLightController },
    'enocean:EnOceanWindowHandle': { id: 'enocean_window_handle', class: WindowHandle },
    'io:DiscreteExteriorHeatingIOComponent': { id: 'heater_on_off', class: HeaterOnOff },
    'internal:PodV2Component': { id: 'hub', class: Hub },
    'internal:PodMiniComponent': { id: 'hub', class: Hub },
    'io:AtlanticPassAPCZoneControlMainComponent': { id: 'io_atlantic_apc_zone_controller', class: AtlanticZoneController },
    'io:AtlanticPassAPCDHWComponent': { id: 'io_atlantic_dhw_boiler', class: AtlanticDHWBoiler },
    'io:AtlanticDomesticHotWaterProductionV2_AEX_IOComponent': { id: 'io_atlantic_dhw_production', class: WaterBoilerProduction },
    'io:DomesticHotWaterTankComponent': { id: 'io_atlantic_dhw_tank', class: WaterTank },
    'io:AtlanticElectricalHeaterWithAdjustableTemperatureSetpointIOComponent': { id: 'io_atlantic_electric_heater', class: ElectricHeater },
    'io:AtlanticPassAPCHeatingAndCoolingZoneComponent': { id: 'io_atlantic_hot_cold_zone', class: HotColdZone },
    'io:AtlanticPassAPCZoneControlZoneComponent': { id: 'io_atlantic_hot_cold_zone', class: HotColdZone },
    'io:LockUnlockDoorLockWithUnknownPositionIOComponent': { id: 'io_door_lock', class: DoorLock },
    'io:TotalElectricalEnergyConsumptionIOSystemSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:TotalElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:OtherElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:PlugsElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:DHWElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:CoolingRelatedElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:HeatingRelatedElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:HeatingElectricalEnergyConsumptionSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:CumulatedElectricalEnergyConsumptionIOSystemDeviceSensor': { id: 'io_energy_sensor', class: EnergySensor },
    'io:ExteriorVenetianBlindIOComponent': { id: 'io_exterior_venetian_blind', class: ExteriorVenetianBlind },
    'io:GarageOpenerIOComponent': { id: 'io_garage_door', class: GarageDoorIOd },
    'io:DiscreteGarageOpenerWithPartialPositionIOComponent': { id: 'io_garage_door_partial', class: GarageDoorPartialIOd },
    'io:HorizontalAwningIOComponent': { id: 'io_horizontal_awning', class: HorizontalAwning },
    'io:AwningValanceIOComponent': { id: 'io_horizontal_awning', class: HorizontalAwning },
    'io:AwningvalanceIOComponent': { id: 'io_horizontal_awning', class: HorizontalAwning },
    'io:AwningReceiverUnoIOComponent': { id: 'io_horizontal_awning', class: HorizontalAwning },
    'io:LightIOSystemSensor': { id: 'io_light_sensor', class: LightSensor },
    'zwave:ZWaveLightSensor': { id: 'io_light_sensor', class: LightSensor },
    'io:SomfyOccupancyIOSystemSensor': { id: 'io_occupancy_detector', class: MotionDetector },
    'rtds:RTDSMotionSensor': { id: 'io_occupancy_detector', class: MotionDetector },
    'zwave:ZWaveNotificationMotionSensor': { id: 'io_occupancy_detector', class: MotionDetector },
    'io:IORemoteController': { id: 'io_open_close_remote', class: io_open_close_remote },
    'io:SomfyContactIOSystemSensor': { id: 'io_opening_detector', class: OpeningDetector },
    'rtds:RTDSContactSensor': { id: 'io_opening_detector', class: OpeningDetector },
    'io:SomfyBasicContactIOSystemSensor': { id: 'io_opening_detector', class: OpeningDetector },
    'io:SimpleBioclimaticPergolaIOComponent': { id: 'io_pergola', class: Pergola },
    'io:RollerShutterGenericIOComponent': { id: 'io_roller_shutter', class: RollerShutter },
    'io:Re3js3W69CrGF8kKXvvmYtT4zNGqicXRjvuAnmmbvPZXnt': { id: 'io_roller_shutter', class: RollerShutter },
    'io:MicroModuleRollerShutterSomfyIOComponent': { id: 'io_roller_shutter', class: RollerShutter },
    'io:RollerShutterUnoIOComponent': { id: 'io_roller_shutter', class: RollerShutter },
    'io:ScreenReceiverUnoIOComponent': { id: 'io_roller_shutter', class: RollerShutter },
    'io:RollerShutterWithLowSpeedManagementIOComponent': { id: 'io_roller_shutter_quiet', class: RollerShutterQuiet },
    'io:SlidingDiscreteGateOpenerIOComponent': { id: 'io_sliding_gate', class: SlidingGate },
    'io:DiscreteGateOpenerIOComponent': { id: 'io_sliding_gate', class: SlidingGate },
    'io:TemperatureIOSystemSensor': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'io:AtlanticPassAPCOutsideTemperatureSensor': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'io:AtlanticPassAPCZoneTemperatureSensor': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'ovp:SomfyPilotWireTemperatureSensorOVPComponent': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'zwave:ZWaveTemperatureSensor': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'io:TemperatureInCelciusIOSystemDeviceSensor': { id: 'io_temperature_sensor', class: TemperatureSensor },
    'io:VerticalInteriorBlindVeluxIOComponent': { id: 'io_velux_interior_blind', class: VeluxInteriorBlind },
    'io:RollerShutterVeluxIOComponent': { id: 'io_velux_roller_shutter', class: VeluxRollerShutter },
    'io:WindowOpenerVeluxIOComponent': { id: 'io_velux_roof_window', class: RoofWindow },
    'io:VerticalExteriorAwningIOComponent': { id: 'io_vertical_exterior_blind', class: VerticalExteriorBlind },
    'io:VerticalExteriorAwningVeluxIOComponent': { id: 'io_vertical_exterior_blind', class: VerticalExteriorBlind },
    'io:VerticalInteriorBlindGenericIOComponent': { id: 'io_vertical_interior_blind', class: VerticalInteriorBlindGenericIO },
    'io:KeygoController': { id: 'key_go_remote', class: key_go_remote },
    'myfox:LightController': { id: 'myfox_light_controller', class: myFoxLightController },
    'rts:LightRTSComponent': { id: 'on_off_switch', class: OnOffLightController },
    'io:LightMicroModuleSomfyIOComponent': { id: 'on_off_switch', class: OnOffLightController },
    'io:OnOffIOComponent': { id: 'on_off_switch', class: OnOffLightController },
    'myfox:SomfyProtectAlarmController': { id: 'one_alarm', class: OneAlarm },
    'myfox:HomeKeeperProAlarmController': { id: 'one_alarm', class: OneAlarm },
    'ovp:SomfyPilotWireHeatingInterfaceOVPComponent': { id: 'pilot_wire_programmer', class: PilotWireProgrammer },
    'rtds:RTDSWaterSensor': { id: 'rtds_water_sensor', class: WaterSensor },
    'rts:GateOpenerRTSComponent': { id: 'rts_gate_opener', class: rtsGateOpener },
    'rts:HorizontalAwningRTSComponent': { id: 'rts_horizontal_awning', class: HorizontalAwningRTS },
    'rts:BlindRTSComponent': { id: 'rts_interior_blind', class: InteriorBlind },
    'rts:RollerShutterRTSComponent': { id: 'rts_interior_blind', class: InteriorBlind },
    'rts:ExteriorBlindRTSComponent': { id: 'rts_interior_blind', class: InteriorBlind },
    'rts:SwingingShutterRTSComponent': { id: 'rts_interior_blind', class: InteriorBlind },
    'rts:DualCurtainRTSComponent': { id: 'rts_interior_curtain', class: InteriorCurtain },
    'rts:CurtainRTSComponent': { id: 'rts_interior_curtain', class: InteriorCurtain },
    'rts:VenetianBlindRTSComponent': { id: 'rts_interior_venetian_blind', class: InteriorVenetianBlind },
    'rts:ExteriorVenetianBlindRTSComponent': { id: 'rts_interior_venetian_blind', class: InteriorVenetianBlind },
    'rts:GarageDoor4TRTSComponent': { id: 'rts_open_close', class: OpenClose },
    'rts:SlidingGateOpener4TRTSComponent': { id: 'rts_open_close', class: OpenClose },
    'rtds:RTDSSmokeSensor': { id: 'smoke_detector', class: SmokeDetector },
    'io:SomfySmokeIOSystemSensor': { id: 'smoke_detector', class: SmokeDetector },
    'internal:TSKAlarmComponent': { id: 'tahoma_alarm', class: TahomaAlarm },
    'enocean:EnOceanOnOffLight': { id: 'two_button_on_off_light', class: two_button_on_off },
    'rts:OnOffRTSComponent': { id: 'two_button_on_off_light', class: two_button_on_off },
    'hue:ColorTemperatureLightBulbHUEComponent': { id: 'white_temperature_light', class: WhiteTemperatureLightController },
    'hue:ColorTemperatureLightSpotHUEComponent': { id: 'white_temperature_light', class: WhiteTemperatureLightController },
};

/**
 * Driver class for the opening detector with the hue:GenericExtendedColorLightHUEComponent controllable name in TaHoma
 * @extends {Driver}
 */
class AllDevicesDriver extends Driver
{

    async onInit()
    {
        await super.onInit();
    }

    onMapDeviceClass(device)
    {
        const dd = device.getData();
        return somfyMap[dd.controllableName].class;
    }

    async onPair(session)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        const linkurl = 'default';

        session.setHandler('showView', async view =>
        {
            if (view === 'login_credentials')
            {
                if (username && password && this.homey.app.loggedIn)
                {
                    await session.nextView();
                }
            }
        });

        session.setHandler('login', async data =>
        {
            username = data.username;
            password = data.password;
            const credentialsAreValid = await this.homey.app.newLogin_2(username, password, linkurl, true);

            // return true to continue adding the device if the login succeeded
            // return false to indicate to the user the login attempt failed
            // thrown errors will also be shown to the user
            return credentialsAreValid;
        });

        session.setHandler('list_devices', async () =>
        {
            this.log('list_devices');
            const username = this.homey.settings.get('username');
            const password = this.homey.settings.get('password');
            if (!username || !password)
            {
                throw new Error(this.homey.__('errors.on_pair_login_failure'));
            }
            return this.onReceiveSetupData();
        });
    }

    async onReceiveSetupData()
    {
        try
        {
            const somfyDevices = await this.homey.app.tahoma.getDeviceData();
            if (somfyDevices)
            {
                this.log('setup resolve');

                const homeyDevices = [];

                for (const somfyDevice of somfyDevices)
                {
                    if (somfyMap[somfyDevice.controllableName])
                    {
                        const manifest = this.homey.manifest.drivers.find(entry => entry.id === somfyMap[somfyDevice.controllableName].id);
                        if (manifest)
                        {
                            const iconPath = manifest.icon.replace('/drivers', '../..');
                            const homeyDevice = {
                                name: somfyDevice.label,
                                icon: iconPath,
                                class: manifest.class,
                                data:
                                {
                                    id: somfyDevice.oid,
                                    deviceURL: somfyDevice.deviceURL,
                                    label: somfyDevice.label,
                                    controllableName: somfyDevice.controllableName,
                                },
                                capabilities: manifest.capabilities,
                                capabilitiesOptions: manifest.capabilitiesOptions,
                                settings: manifest.settings,
                            };

                            this.log(homeyDevice);

                            homeyDevices.push(homeyDevice);
                        }
                    }
                }

                return homeyDevices;
            }
        }
        catch (error)
        {
            this.homey.app.logInformation('OnReceiveSetupData', error);
            throw new Error(error.message);
        }

        return null;
    }

}

module.exports = AllDevicesDriver;
