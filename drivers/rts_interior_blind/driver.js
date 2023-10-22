/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class InteriorBlindDriver extends Driver
{

    async onInit()
    {
        this.deviceType = [
            'rts:BlindRTSComponent',
            'rts:RollerShutterRTSComponent',
            'rts:ExteriorBlindRTSComponent',
            'rts:SwingingShutterRTSComponent',
            'ogp:Blind',
            'profalux868:Profalux868RollerShutter',
            'rts:BottomUpBlindRTSComponent',
            'rts:TopDownBlindRTSComponent',
            'rts:CellularBlindRTSComponent'
        ];
    }

}

module.exports = InteriorBlindDriver;
