#!/usr/bin/env node

/**
 * Create an html summary of all the extensions, ValueSets and CodeSystems in all IG's
 * This should only be run by me at the moment as it updates the summary page
 *   of all NZ artifacts
 *  It also creates a hash that has the location where each VS is defined
 *   (and allowing for duplicate definitions that shouldn't happen - but do)
 *   which is used by individual IG's to show where VS they use are defined 
 *   like in HPI using NZBase. (Not sure if I should do a similar thing for extensions...)
 * 
 *  Invoking (in the folder where the script is located):
 *      ./makeGlobalIGSummmary - will just update the summary file
 *      ./makeGlobalIGSummmary upload - will update the summary file AND upload to the server
 */

//will upload to root@igs.clinfhir.com:/var/www/html/summary.html if true
let uploadToIGServer = false;    

//console.log(process.argv)

if (process.argv.length> 2) {
    let cmd = process.argv[2];
    if (cmd == 'upload') {
        uploadToIGServer = true;
        console.log("Will upload summary to the server")
    }
}
 



//the file that holds the IG that defined each VS
let globalVSDefined = "./allVS.json"
let globalCSDefined = "./allCS.json"
let globalExtDefined = "./allExt.json"      //and all the extensions

const junk = require('junk');

let fs = require('fs');

//the folders and base urls for all IGs in the guide
//note that the folder is the same as the IG id... - important for creating links...
//the base is used by the extension and ValueSet summary to be able to link to the definition from another IG
let arFolder = [{key:"nzbase",base:"http://build.fhir.org/ig/HL7NZ/nzbase/branches/master/"}]
arFolder.push({key:"nhi",base:"http://build.fhir.org/ig/HL7NZ/nhi/branches/master/"})
arFolder.push({key:"hpi",base:"http://build.fhir.org/ig/HL7NZ/hpi/branches/master/"})
arFolder.push({key:"medtech",base:"http://build.fhir.org/ig/HL7NZ/medtech/branches/main/"})
arFolder.push({key:"cca",base:"http://build.fhir.org/ig/HL7NZ/cca/branches/master/"})
arFolder.push({key:"nzf",base:"http://build.fhir.org/ig/HL7NZ/nzf/branches/main/"})
//arFolder.push({key:"nzf",base:"http://build.fhir.org/ig/HL7NZ/nzf/branches/main/"})

//create a hash of IG vs location in build env. Not sure how this will work when an IG is moved - will need to fix the refs
let hashIGLocation = {}
arFolder.forEach(function(item){
    hashIGLocation[item.key] = item.base
})




let onlineServer = "http://build.fhir.org/ig/HL7NZ/";   //where the IGs are. Allows links from the summary...
let onlineBranch = "/branches/master/";     //currently the dev master branch. Used for the link.


//load all the profiles and look up the extensions in use - and the ValueSets (note this comes from the differential)
let hashExtensions = {}         //extensions indexed by url
let hashValueSetPaths = {}      //valuesets used by path
let arProfile = []              //all profiles
arFolder.forEach(function(folder){
    
    //let fullFolderPath = "../" + folder + "/fsh-generated/resources/";
    let fullFolderPath = "../" + folder.key + "/fsh-generated/resources/";
    if (fs.existsSync(fullFolderPath)) {

        let arFiles = fs.readdirSync(fullFolderPath).filter(junk.not);
        arFiles.forEach(function(name){
            if (name.indexOf("StructureDefinition-") > -1 ) {
                let fullFileName = fullFolderPath + "/"+ name;
                let contents = fs.readFileSync(fullFileName).toString();
                let profile = JSON.parse(contents)
                if (profile.type !== 'Extension') {
                    arProfile.push({IG:folder,profile:profile})
                    profile.differential.element.forEach(function(ed){
                        if (ed.type) {
                            ed.type.forEach(function(typ){
                                if (typ.code == 'Extension' && typ.profile) {
                                    typ.profile.forEach(function(prof){
                                        hashExtensions[prof] = hashExtensions[prof] || []
                                        let item = {};
                                        item.profileName = profile.id
                                        item.path = ed.path
                                        item.sliceName = ed.sliceName;
                                        item.IG = folder
                                        hashExtensions[prof].push(item)
                                    })
                                }
                            })
                        }

                        //now the binding
                        if (ed.binding && ed.binding.valueSet) {
                            let vsUrl = ed.binding.valueSet
                            hashValueSetPaths[vsUrl] = hashValueSetPaths[vsUrl] || []

                            let obj = {display:ed.path, IG:folder}
                            obj.linkName = "StructureDefinition-"+profile.id + ".html"
                            hashValueSetPaths[vsUrl].push(obj)

                            //hashValueSetPaths[vsUrl].push({display:ed.path})

                        }


                    })
                }
            }
        })

    }
})


//load the extension definitions for all IGs
let arExtensions = []
arFolder.forEach(function(item){
    let folder = item.key
    //let fullFolderPath = "../" + folder + "/input/extensions";
    let fullFolderPath = "../" + folder + "/fsh-generated/resources/";

    if (fs.existsSync(fullFolderPath)) {
        let arFiles = fs.readdirSync(fullFolderPath).filter(junk.not);
        //console.log(arFiles)
        arFiles.forEach(function(name){
            if (name.indexOf("StructureDefinition-") > -1 ) {
                let fullFileName = fullFolderPath + "/"+ name;
            
                let contents = fs.readFileSync(fullFileName).toString();
                let ext = JSON.parse(contents)
                if (ext.type == 'Extension') {
                    //add to bundle of extensions
                    //bundleExtensions.entry.push({resource:ext})


                    let sum = {name:ext.name,description:ext.description,IG:folder}
                    sum.context = ext.context || [{expression:""}];
                    sum.id = ext.id;
                    sum.canonicalUrl = ext.url; 
                    
                    let ar = ext.url.split('/')
                    sum.url = ar[ar.length-1]
                    arExtensions.push(sum)

                    //now look for extensions that have a binding
                    ext.differential.element.forEach(function(ed){
                        if (ed.binding && ed.binding.valueSet) {
                            let vsUrl = ed.binding.valueSet
                            hashValueSetPaths[vsUrl] = hashValueSetPaths[vsUrl] || []
                            let obj = {display:'Ext: ' + ext.id, IG:folder}
                            obj.linkName = "StructureDefinition-"+ext.id + ".html"
                            hashValueSetPaths[vsUrl].push(obj)

                        }
                    })
                }
            }
        })
    }
})

// now write out the file that has all the extension definitions...
// need to get the full url to the definition


let hashExt = {}     //keyed on url
arExtensions.forEach(function(item){
    let url = item.canonicalUrl;
    let location = hashIGLocation[item.IG] + "StructureDefinition-" + item.id +".html"
    hashExt[url] = hashExt[url] || []  //allow for multiple IGs to define a VS. Useful for audit
    hashExt[url].push({IG:item.IG,description:item.description,location:location})
})

console.log('Summary of all extensions written to: ' + globalExtDefined)
fs.writeFileSync(globalExtDefined,JSON.stringify(hashExt))



/* - sort by IG
arExtensions.sort(function(a,b){
    let c1 = a.context[0].expression
    let c2 = b.context[0].expression
    if (c1 > c2) {
        return 1
    } else {
        return -1
    }
})
*/
//load the ValueSets & CodeSystems
let arVS = [], arCS = [], arNs = []

arFolder.forEach(function(item){
    let folder = item.key
    let fullFolderPath = "../" + folder + "/fsh-generated/resources/";
    if (fs.existsSync(fullFolderPath)) {
        let arFiles = fs.readdirSync(fullFolderPath).filter(junk.not);
        //console.log(arFiles)
        arFiles.forEach(function(name){

            if (name.indexOf("ValueSet") > -1  || name.indexOf("CodeSystem") > -1 || name.indexOf("NamingSystem") > -1) {
                if (name.substr(0,1) !== '.') {
                    let fullFileName = fullFolderPath + "/"+ name;
                    
                    let contents = fs.readFileSync(fullFileName).toString();
                    
                    let json = JSON.parse(contents)
                
                    let ar = name.split('-')
                    switch (ar[0]) {
                        case 'ValueSet' :
                            let vs = {url:json.url,description:json.description,IG:folder}
                            vs.linkName = name.replace('.json','.html')
                            vs.name = json.name
                            vs.id = json.id
                            vs.codeSystem = []
                            if (json.compose && json.compose.include) {
                                json.compose.include.forEach(function(inc){
                                    let linkName = json.name.replace('.json','.html')
                                    linkName = "CodeSystem-"+linkName
                                    vs.codeSystem.push({system:inc.system,IG:folder,linkName:linkName,id:json.id})
                                })
                            }
                            
                            arVS.push(vs)
                            break;
                        case 'CodeSystem' :
                            let cs = {url:json.url,description:json.description,IG:folder,id:json.id}
                            cs.linkName = name.replace('.json','.html')
                            cs.name = json.name
                            
                            console.log(folder + " "  + json.url)
                            
                            arCS.push(cs)
        
                            break;
                        case 'NamingSystem' :
                            json.IG = folder;
                            arNs.push(json)

                            break;
                    }
                }
            }

        })
    } else {
        console.log("Folder not found: "+folder)
    }
    
})

/* sort by IG
arVS.sort(function(a,b){
    if (a.url > b.url) {
        return 1
    } else {
        return -1
    }
})
*/


//console.log("arVS",arVS)

//create and write out the global summary file of where VS are defined
let hashVS = {}     //keyed on url
arVS.forEach(function(item){
    let url = item.url;
    let location = hashIGLocation[item.IG] + "ValueSet-" + item.id +".html"
    hashVS[url] = hashVS[url] || []  //allow for multiple IGs to define a VS. Useful for audit
    hashVS[url].push({IG:item.IG,description:item.description,location:location})
    //console.log(url)
})

let hashCS = {}     //keyed on url
arCS.forEach(function(item){
    let url = item.url;
    let location = hashIGLocation[item.IG] + "ValueSet-" + item.id +".html"
    hashCS[url] = hashCS[url] || []  //allow for multiple IGs to define a VS. Useful for audit
    hashCS[url].push({IG:item.IG,description:item.description,location:location})
    //console.log(url)
})


console.log('Summary of all ValueSets written to: ' + globalVSDefined)
fs.writeFileSync(globalVSDefined,JSON.stringify(hashVS))


console.log('Summary of all CodeSystems written to: ' + globalCSDefined)
fs.writeFileSync(globalCSDefined,JSON.stringify(hashCS))

//console.log("hashVS",hashVS)
//globalVSDefined


//=============== render HTML ============

let ar = []
ar.push("<html>")
ar.push("<head>")
ar.push("<link rel='stylesheet' type='text/css' href='https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css'/>")
ar.push("</head>")

ar.push("<body  style='padding: 8px' >")
ar.push("<h1  class='alert alert-secondary' >Extensions, ValueSets, CodeSystems and Identifiers defined for New Zealand Implementation Guides</h1>")

ar.push("<div><div class='float-right'><em>Summary generated: " + new Date().toString() + "</div></div>");




ar.push("<h2>Profiles</h2>")
ar.push("<table width='100%' border='1' cellspacing='0' cellpadding='5px'>")
ar.push("<tr><th>IG</th><th>Title</th><th>Url</th><th>Description</th></tr>")

arProfile.forEach(function(item){
    let profile = item.profile
    ar.push("<tr>")
    ar.push("<td>" + item.IG + "</td>")

    //let link = profile.title;
    let link = onlineServer + item.IG + onlineBranch + "StructureDefinition-" + profile.id + ".html";

    ar.push("<td><a href='" + link + "'>"  + profile.title + "</a></td>")

   // ar.push("<td>" + link + "</td>")

    ar.push("<td>" + profile.url + "</td>")

    ar.push("<td>" + ( (profile.description) ?  profile.description : "") + "</td>")


   

    ar.push("</tr>")
})

ar.push("</table>")
ar.push("<br/>");

ar.push("<h2>Extensions</h2>")
ar.push("<table width='100%' border='1' cellspacing='0' cellpadding='5px'>")
ar.push("<tr><th>IG</th><th>Id</th><th>Context</th><th>Url</th><th>Description</th><th>Used by</th></tr>")
arExtensions.forEach(function(ext){
    ar.push("<tr>")
    ar.push("<td>" + ext.IG + "</td>")

    //let link = onlineServer + ext.IG + onlineBranch + "StructureDefinition-" + ext.id + ".html";
    let link = hashIGLocation[ext.IG] + "StructureDefinition-" + ext.id + ".html";
    ar.push("<td><a href='" + link + "'>"  + ext.url + "</a></td>")

    ar.push("<td>");
    if (ext.context) {
        ext.context.forEach(function(con){
            ar.push("<div>" + con.expression + "</div>")
        })
    }
    ar.push("</td>");
    ar.push("<td>" + ext.canonicalUrl + "</td>")
    ar.push("<td>" + ( (ext.description) ?  ext.description : "") + "</td>")

    ar.push("<td>");
    if (hashExtensions[ext.canonicalUrl]) {
        hashExtensions[ext.canonicalUrl].forEach(function(item){
            let profileName = item.profileName
            let link = onlineServer + item.IG + onlineBranch + "StructureDefinition-" + profileName + ".html";
            ar.push("<div><a href='" + link + "'>"  + profileName + "</a></div>")
        })
    }
    ar.push("</td>");

    ar.push("</tr>")
})

ar.push("</table>")
ar.push("<br/>");

//render the vs
ar.push("<h2>ValueSets</h2>")
ar.push("<table width='100%' border='1' cellspacing='0' cellpadding='5px'>")
ar.push("<tr><th>IG</th><th>Name</th><th>Url (CodeSystems)</th><th>Description</th><th>Where used</th></tr>")
arVS.forEach(function(vs){
    // {url: description: IG: name: id: codesystem: {system: IG: linkName: }}
    ar.push("<tr>")
   // let link = hashIGLocation[ext.IG] + "StructureDefinition-" + ext.id + ".html";
    ar.push("<td>" + vs.IG + "</td>")
    ar.push("<td>" + vs.name + "</td>")

    //let link = onlineServer + vs.IG + onlineBranch + vs.linkName;
    let link = hashIGLocation[vs.IG] + "ValueSet-" + vs.id + ".html";
    ar.push("<td>");

    ar.push("<a href='" + link + "'>"  + vs.url + "</a>")
    //ar.push("<a href='" + link + "'>"  + vs.url + "</a>")

    vs.codeSystem.forEach(function(system){


        //let csLink = onlineServer + system.IG + onlineBranch + system.linkName;
        let csLink = hashIGLocation[system.IG] + "CodeSystem-" + system.id + ".html";

        ar.push("<div><a href='"+csLink+"' >(" +system.system+ ")</a></div>");
    })
    ar.push("</td>");

    ar.push("<td>" + vs.description + "</td>")

    ar.push("<td>");
    let paths = hashValueSetPaths[vs.url]
    if (paths) {
        paths.forEach(function(obj){
            //let link = obj.linkName
            let link = onlineServer + obj.IG + onlineBranch + obj.linkName;
            ar.push("<div><a href='" + link + "'>" + obj.display + "</a></div>");
        })
    }
   
    ar.push("</td>");

    //hashValueSetPaths


    ar.push("</tr>")
})
ar.push("</table>")
ar.push("<br/>");

//render the cs
ar.push("<h2>CodeSystems</h2>")
ar.push("<table width='100%' border='1' cellspacing='0' cellpadding='5px'>")
ar.push("<tr><th>IG</th><th>Name</th><th>Url</th><th>Description</th></tr>")
arCS.forEach(function(cs){
    ar.push("<tr>")
    ar.push("<td>" + cs.IG + "</td>")
    ar.push("<td>" + cs.name + "</td>")


    //let link = onlineServer + cs.IG + onlineBranch + cs.linkName;
    let csLink = hashIGLocation[cs.IG] + "CodeSystem-" + cs.id + ".html";

    ar.push("<td><a href='" + csLink + "'>"  + cs.url + "</a></td>")



   // ar.push("<td>" + vs.url + "</td>")
    ar.push("<td>" + cs.description + "</td>")


    ar.push("</tr>")
})
ar.push("</table>")
ar.push("<br/>");



//render the identifiers
ar.push("<h2>Identifiers (from namingSystem)</h2>")
ar.push("<table width='100%' border='1' cellspacing='0' cellpadding='5px'>");
ar.push("<tr><th>IG</th><th>Description</th><th>Preferred Url</th><th>Other identifiers</th><th>Responsible</th></tr>")



arNs.sort(function(a,b){
    let c1 = a.IG + a.description
    let c2 = b.IG + b.description
    if (c1 > c2) {
        return 1
    } else {
        return -1
    }
})


arNs.forEach(function(ns){
    //console.log(ns.description )
    let otherId =[];        //to record other ids than url
    let nsLne = "<tr>";
    nsLne += "<td>" + ns.IG + "</td>";
    nsLne += "<td>" + ns.description + "</td>";
    nsLne += "<td>" 
    if (ns.uniqueId) {
        ns.uniqueId.forEach(function(id){
            if (id.type == "uri" && id.preferred == true) {

                let link = onlineServer + ns.IG + onlineBranch + "NamingSystem-" + ns.id + ".html";
                //ar.push("<td><a href='" + link + "'>"  + ext.url + "</a></td>")

                nsLne += "<div><a href='" + link + "'>" + id.value + "</a></div>"


                //nsLne += "<div>" + id.value + "</div>"
            } else {
                //let lne = id
                otherId.push(id)
            }
        })
    } else {
        console.log('-----> missing uniqueid')
    }
    nsLne += "</td>" 
    
    //Other Ids (if any)
    nsLne += "<td>" 
    if (otherId.length > 0) {
        nsLne += "<ul class='list-unstyled'>" 
        otherId.forEach(function(id){
            //nsLne += "<li>" + id.value + " (" + id.type + ") " + ((id.comment) ? id.comment : "" )  +   "</li>"
            nsLne += "<li>" + id.type + ': ' + id.value  + " " + ((id.comment) ? id.comment : "" )  +   "</li>"
        })
        nsLne += "</ul>" 
    }
    nsLne += "</td>" 
    nsLne += "<td>" + ns.responsible + "</td>";
    
    nsLne += "</tr>"
    ar.push(nsLne)

})

ar.push("</table>")
ar.push("<br/>");

ar.push("<br/>");
ar.push("<em>Summary generated: " + new Date().toString());// toISOString() )

ar.push("</body>")
ar.push("</html>")
//console.log(arExtensions)

let summary = ar.join('\r\n')
console.log('HTML summary (suitable for upload) written to: ./output/summary.html')
fs.writeFileSync('./output/summary.html',summary)

if (uploadToIGServer) {
    console.log('Uploading to server...')
    const { exec } = require('child_process');
    
    exec("scp ./output/summary.html root@igs.clinfhir.com:/var/www/html/summary.html",(err,stdout,stderr) =>{

        //console.log(stderr)
        if (err) {
            console.log('Upload failed:',err)
        }
    })
}
