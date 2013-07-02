// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509

var userToken = "<UTAUserTokenGoesHere>";
var geolocator = new Windows.Devices.Geolocation.Geolocator(); // Used to determine the user's position.

(function () {
    "use strict";

    WinJS.Binding.optimizeBindingReferences = true;

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;

    app.onactivated = function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // The application has been newly launched. 
                // Initialize application here.
                
                args.setPromise(WinJS.UI.processAll().then(function () {
                    // After the Maps module is loaded the initMap function will place the Map into the mapdiv element
                    Microsoft.Maps.loadModule('Microsoft.Maps.Map', { callback: initMap });
                }));

                centerOnUserPosition();

                var route = 704;
                routeQuery(route);

                setMapZoom();

                document.getElementById('routeSubmit').onclick = function () {
                    route = document.getElementById('route').value;
                    routeQuery(route);
                    setMapZoom();
                };
                
                setInterval(function () {
                    routeQuery(route);
                    countdown();
                }, 10500);
                
            } else {
                // The application has been reactivated from suspension.
                // Restore application state here.
                centerOnUserPosition();
            }
        }
    };

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. You might use the
        // WinJS.Application.sessionState object, which is automatically
        // saved and restored across suspension. If you need to complete an
        // asynchronous operation before your application is suspended, call
        // args.setPromise().
    };

    app.start();
})();

function countdown() {
    var unixtime = document.getElementById("unixtime_coming_0");
    var count = parseInt(unixtime.innerHTML, 10);
    unixtime.innerHTML = count - 1;

    if (count < 1) {
        clearInterval(counter);
        return;
    }

    var days = Math.floor(count / 86400);
    var hours = Math.floor(count / 3600) % 24;
    var minutes = Math.floor(count / 60) % 60;
    var seconds = count % 60;

    document.getElementById("timer_coming_0").innerHTML = days + "d " + hours + "h " + minutes + "m " + seconds + "s"; // watch for spelling
}

function routeQuery(route) {
    var onwardCalls = "true";
    var uri = "http://api.rideuta.com/SIRI/SIRI.svc/VehicleMonitor/ByRoute?route=" + route + "&onwardcalls=" + onwardCalls + "&usertoken=" + userToken;

    WinJS.xhr({
        url: uri,
        headers: { "If-Modified-Since": "Wed, 12 Jul 1989 00:00:00 GMT" } // Ensures that the query is always made, rather than caching its results.
    }).done(
        function completed(request) {
            processXML(request);
        } //,
        // function error(request) {},
        // function progress (request) {}
        );
    try {
        return new XmlHttpRequest();
    } catch(error) {}
}

var vehicles = [];
function processXML(request) {   
    var controldiv = document.querySelector("#controldiv");

    var responseTimestamp = request.responseXML.querySelector("ResponseTimestamp");
    console.log("Last update at " + responseTimestamp.textContent + '\n');

    var xmlVehicles = request.responseXML.querySelectorAll("MonitoredVehicleJourney");

    vehicles = [];

    for (var i = 0, len = xmlVehicles.length; i < len; ++i) {
        var vehicle = xmlVehicles[i];

        var vehicleObject = {
            // There is more data in the XML for each vehicle if you want to use it.
            vehicleID: vehicle.querySelector("VehicleRef").textContent,           
            location: new Microsoft.Maps.Location(vehicle.querySelector("Latitude").textContent, vehicle.querySelector("Longitude").textContent),
            direction: vehicle.querySelector("DirectionRef").textContent
        };
        
        vehicles.push(vehicleObject);
    }
    updateMap();
}

function updateMap() {
    map.entities.clear();
    
    addUserLocationPin();

    for (var i = 0, len = vehicles.length; i < len; ++i) { // TODO: learn how to use foreach loop with objects.
        var vehicle = vehicles[i];
        console.log(vehicle.vehicleID + ": \n\t" + vehicle.location.latitude + "\n\t" + vehicle.location.longitude + "\n");
        addPushPin(vehicle.location);
    }
}

function setMapZoom() {
    var locations = [];

    for (var i = 0, len = map.entities.getLength(); i < len; ++i) { // Finds the locations of the vehicles.
        var location = map.entities.get(i).getLocation();
        locations.push(location);
    }

    geolocator.getGeopositionAsync().then(function (loc) { // Get the user's location. This is asynchronous from placing the user pin.
                                                                // May want to rework if user is moving quickly.
        var userLocation = {
            latitude: loc.coordinate.latitude,
            longitude: loc.coordinate.longitude
        };

        locations.push(userLocation);
        
        // Once the user's location has been asynchronously retrieved, set the map's view.
        var boundingBox = Microsoft.Maps.LocationRect.fromLocations(locations);
        map.setView({ bounds: boundingBox });
    });
}

// initMap defines several default values: Bing Map credentials, center location, map type, and zoom.
// Then, obtains the mapdiv element and defines a new object called map (from new Map) that receives 
// div and the options.
function initMap() {
    try {
        var mapOptions = {
            credentials: "BingMapsCredentialsGoHere",
            center: new Microsoft.Maps.Location(-110, 40), // May want to change default center that will appear if no geolocation data and no Internet data.
            mapTypeId: Microsoft.Maps.MapTypeId.auto,
            zoom: 5
        };
        var mapDiv = document.querySelector("#mapdiv");
        map = new Microsoft.Maps.Map(mapDiv, mapOptions);
    }
    catch (e) {
        var md = new Windows.UI.Popups.MessageDialog(e.message);
        md.showAsync();
    }
}

function changeMapType() {
    var type = map.getMapTypeId();
    switch (type) {
        case Microsoft.Maps.MapTypeId.aerial:
            type = Microsoft.Maps.MapTypeId.road;
            break;
        case Microsoft.Maps.MapTypeId.road:
            type = Microsoft.Maps.MapTypeId.birdseye;
            break;
        default:
            type = Microsoft.Maps.MapTypeId.aerial;
            break;
    }
    map.setView({ center: map.getCenter(), mapTypeId: type });
}

function centerOnUserPosition() { // Map defaults to showing user pin before any route information is selected.
    geolocator.getGeopositionAsync().then(function (loc) {
        var mapCenter = map.getCenter();
        mapCenter.latitude = loc.coordinate.latitude;
        mapCenter.longitude = loc.coordinate.longitude;
        map.setView({ center: mapCenter, zoom: 15 });
        addPushPin(mapCenter); // Add pin at user's location.
    });
}

// It may be useful to categorize pins, then never remove the user location pin. 
// Does its location update automatically on the map via the geolocator?
// Also, this causes the user pin to flash, even when it doesn't move.
// It'd be useful to not remove and refresh pins that don't move.
function addUserLocationPin() {
    geolocator.getGeopositionAsync().then(function (loc) {
        var location = {
            latitude: loc.coordinate.latitude,
            longitude: loc.coordinate.longitude
        };
        addPushPin(location, "user"); // Add pin at user's location.
        console.log("Userlocation pin added at:\n\t" + location.latitude + "\n\t" + location.longitude + "\n");
    });
}

function addPushPin(location, isUser) {
    // map.entities.clear();
    var pushpin = typeof isUser == 'undefined' ? new Microsoft.Maps.Pushpin(location) :
        new Microsoft.Maps.Pushpin(location, { icon: "images/BluePushpin.png", width: 50, height: 50 });
    map.entities.push(pushpin);
}

