$(document).ready(function() {
   $.getJSON(   "http://demos.fmeserver.com.s3.amazonaws.com/server-demo-config.json",
                function(config) { initialize(config.initObject); });
});

//global vars
var locations = []; //holds user-input points of interest in geoJson
var map; // map object

//initialize FME Server, DOM Elements, Mapbox map
function initialize(initObject) {

    var featureGroup;

    //init server
    FMEServer.init({
        server : initObject.server,
        token : initObject.token
    });

    //init event-driven DOM elements display
    document.getElementById("table").style.display = 'none';
    document.getElementById("fetch-btn").style.display = "none";
    document.getElementById("reset-btn").style.display = 'none';
    document.getElementById("download-btn").style.display= "none";
    document.getElementById("fa-spinner").style.display= "none";

    //init map
    $.getJSON(  "https://s3.amazonaws.com/demos.fmeserver.com/uscensus-explorer/mapbox-config.json",
                function(config) { 
        L.mapbox.accessToken = config.mapBox.accessToken;
        map = L.mapbox.map('mapDiv', 'mapbox.emerald').setView([39,-99],4);
        map.scrollWheelZoom.disable();
        map.on('draw:created', function(e) {
            featureGroup.addLayer(e.layer);
            locations.push(e.layer.toGeoJSON());
            document.getElementById("fetch-btn").style.display = "block";
        });

        //init marker layer
        featureGroup = L.featureGroup().addTo(map);
        featureGroup.projection = L.CRS.EPSG3857;

        //init draw controls
        var drawControl = new L.Control.Draw({
            draw : {
                position : 'topleft',
                polygon : false,
                polyline : false,
                rectangle : false,
                circle : false
            },
            edit: {
             featureGroup: featureGroup,
             edit: false
            }
        }).addTo(map);

        //clear locations data when the leaflet delete tool is used
        map.on('draw:deleted', function (e) {
            locations = [];
            document.getElementById("fetch-btn").style.display = "none";
            document.getElementById('download-btn').style.display = "none";
        });
    });
}

var uscensus = (function() { //private functions

    //private vars
    var json; //holds data streaming response from FME Server
    var geoJson; //mapbox geojson object
    var repository = "uscensus-explorer";
    var style = { weight: 2, color: '#FA8072' }; // default map feature style

    //two functions for feature display styles on mouseover
    function activateFeature(e) {
        geoJson.setStyle(style);
        e.target.setStyle({ weight: 5 });
        displayTable(e);
    }
    function onEachFeature(feature, layer) {
        layer.on({ mouseover: activateFeature });
    }

    //load spatial layer on the map
    function showResults(json) {
        if (typeof geoJson == "undefined") {
            geoJson = L.geoJson(json,
            {
                style: style,
                onEachFeature: onEachFeature //bind mouseover event handler
            }).addTo(map);
        } else {
            geoJson.addData(json);
        }
        map.fitBounds(geoJson.getBounds());
        map.invalidateSize();
        document.getElementById('fa-spinner').style.display = "none";
        document.getElementById('fetch-btn').style.display = "none";
        document.getElementById('fa-server').style.display = "inline-block";
        document.getElementById('reset-btn').style.display = "block";
        document.getElementById('download-btn').style.display = "block";
    }

    //parse JSON response from FME Server into data table
    function displayTable(e) {
        var table = document.getElementById("table");
        var tbody = document.getElementById("tbody");
        tbody.innerHTML = ' ';
        //build table body
        var properties = e.target.feature.properties;
        var variables = Object.keys(properties);
        var values = Object.values(properties);
        var length = Object.keys(properties).length;

        for(let i = 0; i < length; i += 2) { // +=2 allows us to have a two-column table
            tbody.innerHTML += "<tr><td>" + variables[i] + "<td>" + values[i] +
            "<td>" + variables[i+1] + "<td>" + values[i+1]
        }
        table.style.display = "table";
    }

    //automatically download the results
    function downloadURL(json) {
        var uri = json.serviceResponse.url;
        var link = document.createElement("a");
        link.href = uri;
        document.body.appendChild(link);
        link.click()
        document.body.removeChild(link);
        delete link;
    }

    return { //public functions

        //fetch button, datastreaming call to FME Server workspace
        fetchData : function() {
            var workspace = "uscensus.fmw";
            var parameters = "GEOM=" + JSON.stringify(locations);
            json = FMEServer.runDataStreaming(repository,workspace,parameters,showResults);
            document.getElementById("fa-server").style.display= "none";
            document.getElementById("fa-spinner").style.display= "inline-block";
            locations = [];
        },

        //download buttom, datadownload call to FME Server workspace
        dataDownload : function() {
            var data = [];
            for (var i in geoJson._layers) {
                data.push(geoJson._layers[i].feature)
            }
            var workspace = "downloaddata.fmw";
            var parameters = "GEOM=" + JSON.stringify(data);
            FMEServer.runDataDownload(repository,workspace,parameters,downloadURL);
        },

        //reset button
        resetMap : function() {
            locations = [];
            window.location.hash = '#explorer';
            window.location.reload(true);
        }
    };
}());