'use strict';

if ( process.env.DEBUG === '1' )
{
    require( 'inspector' ).open( 9222, '0.0.0.0' )
}

const Homey = require( 'homey' );
const Tahoma = require( './lib/Tahoma' );
const syncManager = require( './lib/sync' );
const nodemailer = require( "nodemailer" );

const INITIAL_SYNC_INTERVAL = 10; //interval of 10 seconds

/**
 * This class is the starting point of the app and initializes the necessary
 * services, listeners, etc.
 * @extends {Homey.App}
 **/
class myApp extends Homey.App
{

    /**
     * Initializes the app
     */
    onInit()
    {
        this.log( `${Homey.app.manifest.id} running...` );
        Homey.ManagerSettings.set( 'diagLog', "" );
        Homey.ManagerSettings.set( 'logEnabled', false );

        this.addScenarioActionListeners();

        if ( !Homey.ManagerSettings.get( 'syncInterval' ) )
        {
            Homey.ManagerSettings.set( 'syncInterval', INITIAL_SYNC_INTERVAL );
        }

        Homey.ManagerSettings.on( 'set', ( setting ) =>
        {
            if ( setting === 'syncInterval' ) this.initSync();
            if ( setting === 'sendLog' && ( Homey.ManagerSettings.get( 'sendLog' ) === "send" ) && ( Homey.ManagerSettings.get( 'diagLog' ) !== "" ) )
            {
                return this.sendLog();
            }
        } );

        Homey.on( 'settings.set', this.initSync );

        this.initSync();
    }

    logDevices( devices )
    {
        if ( Homey.ManagerSettings.get( 'logEnabled' ) )
        {
            let logData = devices;
            let i = 1;
            devices.forEach( element =>
            {
                delete element[ "creationTime" ];
                delete element[ "lastUpdateTime" ];
                delete element[ "shortcut" ];
                delete element[ "deviceURL" ];
                delete element[ "placeOID" ];
                element[ "oid" ] = "temp" + i++;
            } );
            Homey.ManagerSettings.set( 'diagLog', logData );
            Homey.ManagerSettings.set( 'logEnabled', false );
            Homey.ManagerSettings.unset('sendLog');
          }
    }

    async sendLog()
    {
        let tries = 5;
        console.log( "Send Log");

        while ( tries-- > 0 )
        {
            try
            {
                // create reusable transporter object using the default SMTP transport
                let transporter = nodemailer.createTransport(
                {
                    host: Homey.env.MAIL_HOST, //Homey.env.MAIL_HOST,
                    port: 465,
                    ignoreTLS: false,
                    secure: true, // true for 465, false for other ports
                    auth:
                    {
                        user: Homey.env.MAIL_USER, // generated ethereal user
                        pass: Homey.env.MAIL_SECRET // generated ethereal password
                    },
                    tls:
                    {
                        // do not fail on invalid certs
                        rejectUnauthorized: false
                    }
                } );

                // send mail with defined transport object
                let info = await transporter.sendMail(
                {
                    from: '"Homey User" <' + Homey.env.MAIL_USER + '>', // sender address
                    to: Homey.env.MAIL_RECIPIENT, // list of receivers
                    subject: "Tahoma device log", // Subject line
                    text: JSON.stringify( Homey.ManagerSettings.get( 'diagLog' ), null, 2 ) // plain text body
                } );

                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

                // Preview only available when sending through an Ethereal account
                console.log( "Preview URL: ", nodemailer.getTestMessageUrl( info ) );
                return "";
            }
            catch ( err )
            {
                console.log( "Send log error: ", err.stack );
            };
        }
    }

    /**
     * Initializes synchronization between Homey and TaHoma
     * with the interval as defined in the settings.
     */
    initSync()
    {
        let interval = null;
        try
        {
            interval = Number( Homey.ManagerSettings.get( 'syncInterval' ) );
        }
        catch ( e )
        {
            interval = INITIAL_SYNC_INTERVAL;
        }
        syncManager.init( interval * 1000 );
    }

    /**
     * Adds a listener for flowcard scenario actions
     */
    addScenarioActionListeners()
    {
        /*** ADD FLOW ACTION LISTENERS ***/
        new Homey.FlowCardAction( 'activate_scenario' )
            .register()
            .registerRunListener( args => Tahoma.executeScenario( args.scenario.oid ) )
            .getArgument( 'scenario' )
            .registerAutocompleteListener( query =>
            {
                return Tahoma.getActionGroups()
                    .then( data => data
                        .map( ( { oid, label } ) => ( { oid, name: label } ) )
                        .filter( ( { name } ) => name.toLowerCase().indexOf( query.toLowerCase() ) > -1 ) )
                    .catch( error =>
                    {
                        console.log( error.message, error.stack );
                    } );
            } );
    }

}

module.exports = myApp;