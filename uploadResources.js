#!/usr/bin/env node

/**
 * Upload Profiles and Extension Definitions across all IG's to a conformance server
 * Also terminology resources to a terminology server
 */

let syncRequest = require('sync-request');

//let confServerRoot = "http://home.clinfhir.com:8054/baseR4/";   //the server to upload conformance resources
//let termServerRoot = "http://home.clinfhir.com:8054/baseR4/";   //the server to upload terminology resources

let confServerRoot = "http://hapi.fhir.org/baseR4/";   //the server to upload conformance resources
let termServerRoot = "http://hapi.fhir.org/baseR4/";   //the server to upload terminology resources



if (!String.prototype.endsWith) {
	String.prototype.endsWith = function(search, this_len) {
		if (this_len === undefined || this_len > this.length) {
			this_len = this.length;
		}
		return this.substring(this_len - search.length, this_len) === search;
	};
}

const junk = require('junk');

let fs = require('fs');
let arIGFolder = ["cca"]     //IGs to search
//let arIGFolder = ["nhi","hpi","northernRegion"]     //IGs to search

let arErrors = []

//need to upload codesystems first
let arTerminology = [], arCS = [] //Ter

//iterate through the output folder (from the IG publisher)
arIGFolder.forEach(function(folder){
    let fullFolderPath = "../" + folder + "/output";
    if (fs.existsSync(fullFolderPath)) {

        let arFiles = fs.readdirSync(fullFolderPath).filter(junk.not);
        var url;
        arFiles.forEach(function(name){

            if (name.endsWith('.json')) {
                //This is the json representation of the resource
               
                let fullFileName = fullFolderPath + "/"+ name;           
                let contents = fs.readFileSync(fullFileName).toString();
                console.log('--------------');
                console.log(fullFileName)
                let resource;
                try {
                    //the openAPI json generates a parsing error...
                    resource = JSON.parse(contents)
                    let ar = name.split('-')

                    switch (ar[0]) {
                        case "StructureDefinition" :
                        case "SearchParameter" :
                        case "OperationDefinition" :
                            //Profile and Extension Definition
                            //delete resource.fhirVersion;      //just for my server...
                            url = confServerRoot + ar[0] +  "/" + resource.id
                            PUTFile(url,resource)
                            break;
                        case "CodeSystem" :
                        case "ValueSet":
                        case "NamingSystem":
                            url = termServerRoot + ar[0] +  "/" + resource.id
                            PUTFile(url,resource)
                            break;
                        }
                    }
                catch(ex) {
                    arErrors.push('Error parsing ' + fullFileName + " - ignoring...")
                }                
            }
        })
    }
})

if (arErrors.length > 0) {
    console.log("================== There were errors ==================")
    arErrors.forEach(function(err){
        console.log(err)
    })
}


function PUTFile(url,resource) {
   // console.log('--------------');
    console.log(url);

   // return

    var options = {};
    options.headers = {"content-type": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds
    options.body = JSON.stringify(resource);

    var response = syncRequest('PUT', url, options);
    console.log(response.statusCode)
    if (response.statusCode !== 200 && response.statusCode !== 201) {
        arErrors.push('  error' + response.body.toString())
        console.log('  error' + response.body.toString())
        return false
    } else {
        if (response.statusCode == 200) {
            console.log('Updated ' + url)
        } 
        
        if (response.statusCode == 201) {
            console.log('Created ' + url)
        }
       
        return true
    }
}