/**********************************************************************************
 * Author: Riley Kraft
 * Date: 12/03/2018
 * Description: This program serves an a zoo API to create, view, and delete 
 *              animals and eclosures by owner. See function synopses for more 
 *              details.
 * Sources: Heavily derived from (my) kraftme-assignments-3,4,5,7 server.js files 
 * 			and test collections.
 *********************************************************************************/
const express = require('express');
const app = express();
const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');
const session = require('express-session');

const request = require('request');
const randomString = require('randomstring');
const bodyParser = require('body-parser');

const ClientId = "Hw6MFdOrNI9KE1cbbVHrAwixGHVn29CH";
const ClientSecret = "BbarCqVPmbZQI4l1uDcCcBk-dYZRvq3dV_pBJ4WK5U2mBA85WwZp1Wgrs50lKANN";
const RedirectionUrl = "https://kraftme-223903.appspot.com/oauth";

const Datastore = require('@google-cloud/datastore');

const projectId = 'kraftme-223903';
const datastore = new Datastore({projectId:projectId});

const ANIM = "Animal";
const ENCL = "Enclosure";

app.use(session({secret: randomString.generate()}));
app.use(bodyParser.json());


/**********************************************************************************
 * fromDatastore() appends the object's key id to the object in the field 'id'
 *********************************************************************************/
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

/**********************************************************************************
 * enclosure_url() appends the self link for each enclosure to the request response
 *********************************************************************************/
function enclosure_url(item){
	item.self = 'https://kraftme-223903.appspot.com/enclosures/' + item['id'];
	return item;
}

/**********************************************************************************
 * animal_url() appends the self link for an animal to the request response
 *********************************************************************************/
function animal_url(item){
	item.self = 'https://kraftme-223903.appspot.com/animals/' + item['id'];
	return item;
}

/**********************************************************************************
 * animal_array() appends an animal array for each enclosure
 *********************************************************************************/
function animal_array(item){
	item.animals = [];
	return item;
}

/**********************************************************************************
 * Authentication middleware. When used, the Access Token must exist and be 
 * verified against the Auth0 JSON Web Key Set
 *********************************************************************************/
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 20,
    jwksUri: 'https://kraftme.auth0.com/.well-known/jwks.json'
  }),

  // Validate the audience and the issuer.
  issuer: 'https://kraftme.auth0.com/',
  algorithms: ['RS256']
});

/* ------------- Begin Model Functions ------------- */

/**********************************************************************************
 * post_animal() takes the new animal name, species and age as arguments to 
 * initialize the animal data, then saves the data to the datastore and returns
 * the new animal's key
 *********************************************************************************/
function post_animal(name, species, age, enclosure){
    var key = datastore.key(ANIM);
	const new_animal = {"name": name, "species": species, "age": age, "enclosure": enclosure};
	return datastore.save({"key":key, "data":new_animal}).then(() => {return key});
}

/**********************************************************************************
 * get_animals() queries the datastore for all objects of the Animal kind, then
 * calls functions to append data to the datastore response in order to display
 * each object's ID. The objects are returned to the calling function to be sent 
 * as a JSON response. In addition, for queries resulting in more than 5 records, 
 * pagination will be appended with a next cursor link. The objects are returned 
 * to the calling function to be sent as a JSON response.
 *********************************************************************************/
function get_animals(req){
    let q = datastore.createQuery(ANIM).limit(5);                           // Get only 3 CARGO objects 
    const results = {};
    if(Object.keys(req.query).includes("cursor")){                           // If the query contains a cursor
        q = q.start(req.query.cursor);                                         // Set next page query to begin at cursor
    }
	return datastore.runQuery(q).then( (entities) => {                       // Get query results
	  results.items = entities[0].map(fromDatastore).map(animal_url);         // Append id and self link to each object
	  if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){             // If there are more results
            results.next = "https://kraftme-223903.appspot.com/animals?cursor=" 
            	+ entities[1].endCursor;                                            // Append a next link to the response
          }
	  let count = datastore.createQuery(ANIM);
	  return datastore.runQuery(count).then( (items) => {                       // Get query results
		results.collectionSize = items[0].length
		return results;
	  });
	});
}

/**********************************************************************************
 * get_all_animals() queries the datastore for all objects of the ANIM kind, then
 * calls functions to append data to the datastore response in order to display
 * each object's ID. The objects are returned to the calling function to be sent 
 * as a JSON response. This function does not feature pagination.
 *********************************************************************************/
function get_all_animals(){
	let q = datastore.createQuery(ANIM);
	return datastore.runQuery(q).then( (entities) => {
		return entities[0].map(fromDatastore).map(animal_url);
	});
}

/**********************************************************************************
 * get_an_animal() takes an animal ID as an argument and queries the datastore for
 * the Animal object with said ID, then call a functions to append data to the
 * datastore response in order to display to the animal's ID. The object is 
 * returned to the calling function to be sent as a JSON response.
 *********************************************************************************/
function get_an_animal(id){
	let q = datastore.createQuery(ANIM)
	.filter('__key__', '=', datastore.key([ANIM, parseInt(id,10)]));
	
	return datastore.runQuery(q).then( (entity) => {
		return entity[0].map(fromDatastore).map(animal_url);
	});
}

/**********************************************************************************
 * put_animal() takes all of a ship's data as it's arguments, finds the ship
 * object's key in the datastore based on it's ID, arranges the data, then calls
 * the datastore function to save the updated data to the datastore at the ship
 * object's key
 *********************************************************************************/
function put_animal(id, name, species, age, enclosure){
    const key = datastore.key([ANIM, parseInt(id,10)]);
    const animal = {"name": name, "species": species, "age": age, "enclosure": enclosure};
    return datastore.save({"key":key, "data":animal});
}

/**********************************************************************************
 * delete_animal() takes the animal ID as an argument to find the animal's key in 
 * the datastore, then calls the datastore function to delete the animal object 
 * with that key.
 *********************************************************************************/
function delete_animal(id){
    const key = datastore.key([ANIM, parseInt(id,10)]);
    return datastore.delete(key);
}

/**********************************************************************************
 * post_enclosure() takes the new enclosure number as an argument to initialize 
 * the enclosure data, then saves the data to the datastore and returns the new 
 * enclosure's key
 *********************************************************************************/
function post_enclosure(number, type, size, owner){
    var key = datastore.key(ENCL);
	const new_enclosure = {"number": number, "type": type, "size": size, "owner": owner};
	return datastore.save({"key":key, "data":new_enclosure}).then(() => {return key});
}

/**********************************************************************************
 * get_enclosures() queries the datastore for all objects of the ENCL kind, then
 * calls functions to append data to the datastore response in order to display
 * each object's ID and, if applicable, a link to its animal records. In addition, 
 * for queries resulting in more than 5 records, pagination will be appended with 
 * a next cursor link. The objects are returned to the calling function to be sent 
 * as a JSON response.
 *********************************************************************************/
function get_enclosures(req, owner){
	let q = datastore.createQuery(ENCL).filter('owner', owner).limit(5);             // Get only 5 ENCL objects
	const results = {};
    if(Object.keys(req.query).includes("cursor")){                                      // If the query includes a cursor
        q = q.start(req.query.cursor);                                                    // Set next query to being at cursor
    }
	return datastore.runQuery(q).then( (entities) => {                                     // Run query
		results.items = entities[0].map(fromDatastore).map(enclosure_url).map(animal_array);     // Append each result with id, self link, and cargo array
		
		if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){                       // If there are more results
            results.next = "https://kraftme-223903.appspot.com/users/"+owner+"/enclosures?cursor="               // Append a next link to the response
            	+ entities[1].endCursor;
        }
		let count = datastore.createQuery(ENCL).filter('owner', owner);
		return datastore.runQuery(count).then( (items) => {                               // Get query results
			results.collectionSize = items[0].length
			return results;
		});
	});
}

/**********************************************************************************
 * get_enclosures_unprotected() queries the datastore for all objects of the ENCL 
 * kind, then calls functions to append data to the datastore response in order 
 * to display each object's ID. The objects are returned to the calling function 
 * to be sent as a JSON response. In addition, for queries resulting in more
 * than 5 records, pagination will be appended with a next cursor link. The 
 * objects are returned to the calling function to be sent as a JSON response.
 *********************************************************************************/
function get_enclosures_unprotected(req){
	let q = datastore.createQuery(ENCL).limit(5);
	const results = {};
    if(Object.keys(req.query).includes("cursor")){                               // If the query contains a cursor
        q = q.start(req.query.cursor);                                             // Set next page query to begin at cursor
    }
	return datastore.runQuery(q).then( (entities) => {
		results.items = entities[0].map(fromDatastore).map(enclosure_url).map(animal_array);
		
		if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){              // If there are more results
            results.next = "https://kraftme-223903.appspot.com/enclosures?cursor=" 
            	+ entities[1].endCursor;                                           // Append a next link to the response
        }
		const count = datastore.createQuery(ENCL);
		return datastore.runQuery(count).then( (widgets) => {                               // Get query results
			results.collectionSize = widgets[0].length
			return results;
		});
	});
}

/**********************************************************************************
 * get_all_enclosures() queries the datastore for all objects of the ENCL kind, 
 * then calls functions to append data to the datastore response in order to 
 * display each object's ID and, if applicable, a link to it's residents record. 
 * The objects are returned to the calling function to be sent as a JSON response. 
 * This function does not feature pagination.
 *********************************************************************************/
function get_all_enclosures(){
	const q = datastore.createQuery(ENCL);
	return datastore.runQuery(q).then( (entities) => {
		return entities[0].map(fromDatastore).map(enclosure_url).map(animal_array);
	});
}

/**********************************************************************************
 * get_an_enclosure() takes an enclosure ID as an argument and queries the 
 * datastore for the ENCL object with said ID, then calls functions to append data 
 * to the datastore response in order to display to the enclosure's ID and, if 
 * applicable, a link to it's residents record. The object is returned to the 
 * calling function to be sent as a JSON response.
 *********************************************************************************/
function get_an_enclosure(id){
	const q = datastore.createQuery(ENCL)
	.filter('__key__', '=', datastore.key([ENCL, parseInt(id,10)]));
	
	return datastore.runQuery(q).then( (entity) => {
		return entity[0].map(fromDatastore).map(enclosure_url).map(animal_array);
	});
}

/**********************************************************************************
 * get_enclosure_animals() queries for all animal objects with the enclosure id 
 * matching the enclosure id in the parameters. This function also sets up and 
 * returns pagination
 *********************************************************************************/
function get_enclosure_animals(req, id){
	let q = datastore.createQuery(ANIM).filter('enclosure', id).limit(5);       // Get 3 CARGO objects with carrier id
	const results = {};
	if(Object.keys(req.query).includes("cursor")){                                  // If the query has a cursor
        q = q.start(req.query.cursor);                                                // Set next query to start at cursor
    }
	return datastore.runQuery(q).then((entities) => {                               // Get results
		results.items = entities[0].map(fromDatastore).map(animal_url);                // For each item, append an id and self link
		
		if(entities[1].moreResults !== Datastore.NO_MORE_RESULTS ){                   // If there are more results
            results.next = "https://kraftme-223903.appspot.com/enclosures/"+id 
            				+"/animals?cursor=" + entities[1].endCursor;                 // Append a next link to the response
        }
		let count = datastore.createQuery(ANIM).filter('enclosure', id);
		return datastore.runQuery(count).then( (items) => {                               // Get query results
			results.collectionSize = items[0].length
			return results;
		});
	});
}

/**********************************************************************************
 * get_all_enclosure_animals() is the same function as get_enclosure_animals(), 
 * but without pagination
 *********************************************************************************/
function get_all_enclosure_animals(id){
	const q = datastore.createQuery(ANIM).filter('enclosure', '=', id);  // Query animal with enclosure id
	
	return datastore.runQuery(q).then((entities) => {                   // Set animal's id and self link, then return
		return entities[0].map(fromDatastore).map(animal_url);
	});
}

/**********************************************************************************
 * put_enclosure() takes all of an enclosure's data as it's arguments, finds the 
 * enclosure object's key in the datastore based on it's ID, arranges the data, 
 * then calls the datastore function to save the updated data to the datastore at 
 * the enclosure object's key
 *********************************************************************************/
function put_enclosure(id, number, type, size, owner){
    const key = datastore.key([ENCL, parseInt(id,10)]);
    const enclosure = {"number": number, "type": type, "size": size, "owner": owner};
    return datastore.save({"key":key, "data":enclosure});
}

/**********************************************************************************
 * delete_enclosure() takes an enclosure ID as an argument to find the enclosure's 
 * key in the datastore, then calls the datastore function to delete the enclosure 
 * object with that key
 *********************************************************************************/
function delete_enclosure(id){
    const key = datastore.key([ENCL, parseInt(id,10)]);
    return datastore.delete(key);
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

/**********************************************************************************
 * GET ANIMALS calls the function to GET all the animal kind objects in the 
 * datastore. The function returns the animal objects. A function is  then called 
 * to get all the enclosures in the datastore and compare each animal's ID to the 
 * current_animals living in the enclosures. If an animal ID is found to be a 
 * current_animal in an enclosure, a homeless property is appended to the animals 
 * response as true. If the animal ID is not found in an enclosure, then the 
 * homeless property is appended as false. Finally, the animal objects are 
 * returned to the requester as a JSON response.
 *********************************************************************************/
app.get('/animals', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if(req.user.name == null){                                                                                   // If not user authentication
			res.status(401).send("Error 401 Unauthorized: you must be a logged in user to access this information");   // Send error
		}
		else{
		    const animals = get_animals(req).then( (animals) => {						     // Get all animal objects
				const enclosures = get_all_enclosures().then((enclosures) =>{                 // Get all enclosure objects
		    		animals.items.forEach(function(element){                                   // For each animal
		    			enclosures.forEach(function(enclosure){                                 // For each enclosure
		    				if(enclosure.id == element.enclosure){                               // If the enclosure ID matched the animal enclosure
		    					element.enclosure = {"id": enclosure.id, 
		    							"number": enclosure.number, "self": enclosure.self};       // Replace animal enclosure with enclosure id, number, and self link
		    				}
		    			});
		    		});
		    		res.status(200).json(animals);                                           // Return animal objects as JSON
		    	});
		    });
		}
	}
});

/**********************************************************************************
 * GET ANIMAL ID confirms the animal ID is valid and exists, then calls the function
 * to get an animal object by ID from the datastore. The function returns the object,
 * after which it is sent as a JSON object.
 *********************************************************************************/
app.get('/animals/:id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (req.params.id.length != 16 || isNaN(req.params.id)) {                // Validate ship ID
			res.status(404).send('Error 404: invalid animal ID NOT FOUND');
		}
		else{
			if(req.user.name == null){                                                                                   // If not user credentials
				res.status(401).send("Error 401 Unauthorized: you must be a logged in user to access this information");  // Send error
			}
			else{
			    const animal = get_an_animal(req.params.id)                               // Get the animal object
				.then( (animal) => {
					if(animal[0] == null){                                             // If object is null
						res.status(404).send('Error 404: animal ID NOT FOUND').end();    // Animal ID does not exist
			    	}
					else{                                                                                   // Else
						if(animal[0].enclosure != null){                                                       // If animal enclosure is not null
					        const enclosure = get_an_enclosure(animal[0].enclosure).then((enclosure) => {         // Get the corresponding enclosure
						        	animal[0]['enclosure'] = {"id": enclosure[0].id, 
						        	"number": enclosure[0].number, 
						        	"self": enclosure[0].self}                                          // Replace enclosure with enclosure info
						            
						            res.status(200).json(animal);                                   // Return the animal object as JSON
					        });
			    		}
			    		else{                                                                // Else
			    			res.status(200).json(animal);                                       // Return the animal object as JSON
			    		}
				        
					}
			    });
			}
		}
	}
});

/**********************************************************************************
 * POST ANIMAL validates the body data submitted by the request, gets the JWT for
 * the user credentials, validates the user credentials, confirms the new animal 
 * name is unique, then calls the function to POST the new animal to the GCP 
 * Datastore.
 *********************************************************************************/
app.post('/animals', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
		if (!req.body.name || !req.body.species || !req.body.age || !isNaN(req.body.name)  // Validate body data
			|| !isNaN(req.body.species) || isNaN(req.body.age)) {
			res.status(403).send('Error 403 Forbidden: invalid animal data');
		}
		else{
			if(req.user.name == null){                                                                                   // If not user credentials
				res.status(401).send("Error 401 Unauthorized: you must be a logged in user to access this information");  // Send error
			}
			else{
				const animals = get_all_animals().then((animals) => {                        // Get all animals
					var x = 0;
					for(var i = 0; i < animals.length; i++){                                   // For each animal
						if(animals[i]['name'] == req.body.name){                                  // If the body.name matches an existing animal name
							x++;                                                                     // Increment x
						}
					}
					
					if(x > 0){                                                                         // If x has been incremented
						res.status(409).send('Error 409 Forbidden: animal name already exists').end();   // That animal name is taken
					}
					else{                                                                              // Else
						post_animal(req.body.name, req.body.species, req.body.age, null)                   // POST the new animal to the datastore and return the key.id
						.then( key => {
							res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
							res.status(201).send('{ "id": "' + key.id + '" }').end()});
					}
				});
			}
		}
	}
});

/**********************************************************************************
 * PUT ANIMAL validates the body data submitted by the request, confirms the animal
 * ID is valid and exists, confirms the request is not attempting to change the
 * animal name to another existing animal name.
 *********************************************************************************/
app.put('/animals/:id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (!req.body.name || !req.body.species || !req.body.age || !isNaN(req.body.name)
			|| !isNaN(req.body.species) || isNaN(req.body.age)) {
			res.status(403).send('Error 403 Forbidden: invalid animal data');              // Validate animal data
		}
		else{
			if (req.params.id.length != 16 || isNaN(req.params.id)) {                        // Validate animal ID
				res.status(403).send('Error 403 Forbidden: invalid animal ID');
			}
			else{
				if(req.user.name == null){                                                                                   // If not user credentials
					res.status(401).send("Error 401 Unauthorized: you must be a logged in user to access this information");   // Send error
				}
				else{
				    const anAnimal = get_an_animal(req.params.id)                                                 // Get animal object
				    .then((anAnimal) => {
				    	if(anAnimal[0] == null){                                                                    // If object is null
				    		res.status(404).send('Error 404 Not Found: animal ID NOT FOUND').end();                   // Animal ID does not exist
				    	}
				    	else{
				    		const animals = get_all_animals().then((animals) => {                                       // Get all animals
				    			var x = 0;
				    			for(var i = 0; i < animals.length; i++){                                                 // For each animal
				    				if(animals[i].name == req.body.name && 
				    				   animals[i].id != req.params.id){                                                   // If the body.name matches another animal's name
				    					x++;                                                                                // Increment x
				    				}
				    			}
				    			
				    			if(x > 0){                                                                               // If x has been incremented
				    				res.status(409).send('Error 409 Conflict: animal name already exists').end();         // The animal name is already taken
				    			}
				    			else{																				     // Else
				    				if(req.body.enclosure !== null){
					    				const enclosure = get_an_enclosure(anAnimal[0].enclosure)                          // Get the enclosure object
					    			    .then((enclosure) => {
				    			    		if(enclosure[0].owner !== req.user.name){
				    			    			res.status(401).send("Error 401 Unauthorized: this animal is currently being kept in another user's enclosure")
				    			    		}
				    			    		else{
					    			    		put_animal(req.params.id, req.body.name, req.body.species, req.body.age, req.body.enclosure)  	    // Update animal with all body data
								   				.then(res.status(303).location('https://kraftme-223903.appspot.com/animals/'+req.params.id).end());
				    			    		}
					    			    });
				    				}
				    				else{
				    					put_animal(req.params.id, req.body.name, req.body.species, req.body.age, req.body.enclosure)  	     // Update animal with all body data
						   				.then(res.status(303).location('https://kraftme-223903.appspot.com/animals/'+req.params.id).end());
				    				}
					   			}
					   		});
					   	}
					}); 
				}
			}
		}
	}
});

/**********************************************************************************
 * DELETE ANIMAL confirms the ship ID is valid and exists, gets the JWT for
 * the user credentials, validates the user credentials, then checks if the ship
 * ID appears as the current_ship docked in any existing slips. If so, the slip
 * is updated to set its current_ship and arrival_date to null. Finally, the
 * function is called to delete the ship record from the datastore
 *********************************************************************************/
app.delete('/animals/:id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (req.params.id.length != 16 || isNaN(req.params.id)) {        // Validate id
			res.status(403).send('Error 403 Forbidden: invalid animal ID');
		}
		else{
			if(req.user.name == null){                                                  // If not user credentials
				res.status(401).send("Error 401: invalid authorization credentials");     // Send error
			}
			else{
				const animal = get_an_animal(req.params.id)                    						// Get animal
			    .then((animal) => {
			    	if(animal[0] == null){                                                    			// If object is null
			    		res.status(404).send('Error 404 Not Found: invalid animal ID').end();           // Animal does not exist
			    	}
			    	else{																		         // Else
			    		if(animal[0].enclosure !== null){ 
			    			const enclosure = get_an_enclosure(animal[0].enclosure)                        // Get the enclosure object
		    			    .then((enclosure) => {
		    			    	if(enclosure[0] == null){                                                         // If enclosure object not found
		    			    		res.status(404).send("Error 404: animal's enclosure ID NOT FOUND").end();        // Enclosure ID provided does not exist
		    			    	}
		    			    	else{
		    			    		if(enclosure[0].owner !== req.user.name){
		    			    			res.status(401).send('Error 401 Unauthorized: this animal is cared for by another user').end();   // User does not care for this animal
		    			    		}
		    			    		else{
		    			    			delete_animal(req.params.id).then(res.status(204).end());	                // Call function to delete animal object
		    			    		}
		    			    	}
		    			    });
			    		}
			    		else{
			    			delete_animal(req.params.id).then(res.status(204).end());	                // Call function to delete animal object
			    		}
			    	}
			    });
			}
		}
	}
});

/**********************************************************************************
 * GET USER ENCLOSURES calls the function to GET all the ENCL kind objects in the 
 * datastore whose owner field matches the user ID parameter passed to the request.
 * The function returns the enclosure objects. The enclosure objects are returned 
 * to the requester as a JSON response.
 *********************************************************************************/
app.get('/users/:id/enclosures', checkJwt, function(req, res) {  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if(req.user.name == null){                                                  // If not user credentials
			res.status(401).send("Error 401: invalid authorization credentials");     // Send error
		}
		else{
			if(req.params.id != req.user.name){                                                                // If userID does not match JWT user name
				res.status(401).send("Error 401: user credentials do not have access to userID's enclosures");     // Send error
			}
			else{
				const enclosures = get_enclosures(req, req.user.name).then( (enclosures) => {   // Get all enclosure objects
					const animals = get_all_animals().then((animals) =>{                          // Get all animals
			    		enclosures.items.forEach(function(enclosure){                               // For each enclosure
			    			animals.forEach(function(element){                                        // For each animal
			    				if(enclosure.id == element.enclosure){                                  // If enclosure id equals animal enclosure
			    					enclosure['animals'].push({"id": element.id, 
			    						"name": element.name,
			    						"self": element.self});                                           // Push animal id, name and self link into enclosure's animal array
			    				}
			    			});
			    		});
			    		res.status(200).json(enclosures);                                  // Return enclosure objects as JSON
			    	});
			    });
			}
		}
	}
});

/**********************************************************************************
 * GET ENCLOSURES calls the function to GET all the enclosure kind objects in the 
 * datastore. The function returns the objects, after which they are sent as a 
 * JSON response.
 *********************************************************************************/
app.get('/enclosures', checkJwt, function(req, res){ 
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if(req.user.name == null){                                                              // If not a user authentication
			res.status(401).send("Error 401 Unauthorized: invalid authorization credentials");    // Send error
		}
		else{
		    const enclosures = get_enclosures_unprotected(req).then( (enclosures) => {			// Get all enclosures
		    	const animals = get_all_animals().then((animals) =>{                              // Get all animals
		    		enclosures.items.forEach(function(enclosure){                                   // For each enclosure
		    			animals.forEach(function(element){                                            // For each animal
		    				if(enclosure.id == element.enclosure){                                      // If enclosure id equals animal enclosure
		    					enclosure['animals'].push({"id": element.id, 
		    						"name": element.name,
		    						"self": element.self});                                               // Push animal id, name and self link into enclosure's animals array
		    				}
		    			});
		    		});
		    		res.status(200).json(enclosures);                                  // Return enclosure object as JSON
		    	});
		    });
		}
	 }
});

/**********************************************************************************
 * GET ENCLOSURE ID confirms the enclosure ID is valid and exists, then calls the 
 * function to get an enclosure object by ID from the datastore. The function 
 * returns the object, after which it is sent as a JSON object.
 *********************************************************************************/
app.get('/enclosures/:id', checkJwt, function(req, res){   
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (req.params.id.length != 16 || isNaN(req.params.id)) {          // Validate enclosure ID
			res.status(403).send('Error 403: invalid enclosure ID');
		}
		else{
			if(req.user.name == null){                                              // If not user credentials
				res.status(401).send('Error 401 Unauthorized: invalid credentials');  // Send error
			}
			else{
			    const enclosure = get_an_enclosure(req.params.id).then( (enclosure) => {     // Get the enclosure object
					if(enclosure[0] == null){                                                  // If object is null
						res.status(404).send('Error 404: enclosure ID NOT FOUND').end();         // Enclosure ID does not exist
			    	}
					else{                                                                      // Else
						const animals = get_all_enclosure_animals(req.params.id).then((animals) => {   // Get enclosure's animals
							animals.forEach(function(element){                                 // For each animal
								enclosure[0]['animals'].push({"id": element.id, 
									"name": element.name,
									"self": element.self});                                      // Push the id, name and self link into an array
							});
							res.status(200).json(enclosure);                             // Return enclosure object as JSON
						});
					}
			    });
			}
		}
	}
});

/**********************************************************************************
 * GET ENCLOSURE ANIMALS confirms the enclosure ID is valid and exists, then calls 
 * the function to get an enclosure object by ID from the datastore. Then the 
 * function is called to get all the animal objects associated with the 
 * enclosure's id. The function returns the object, after which it is sent as a 
 * JSON object.
 *********************************************************************************/
app.get('/enclosures/:id/animals', checkJwt, function(req, res){   
	if(req.get('accept') !== 'application/json'  && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (req.params.id.length != 16 || isNaN(req.params.id)) {          // Validate ship ID
			res.status(403).send('Error 403: invalid enclosure ID');
		}
		else{
			if(req.user.name == null){                                                // If not user credentials
				res.status(401).send('Error 401 Unauthorized: invalid credentials');    // Send error
			}
			else{
			    const enclosure = get_an_enclosure(req.params.id)                           // Get the enclosure object
				.then( (enclosure) => {
					if(enclosure[0] == null){                                                     // If object is null
						res.status(404).send('Error 404: enclosure ID NOT FOUND').end();            // Enclosure ID does not exist
			    	}
					else{                                                                              // Else
						if(enclosure[0].owner !== req.user.name){                                       // If enclosure owner does not match user name
							res.status(403).send('Error 403: user does not keep this enclosure').end();    // User does not keep this enclosure
						}
						else{
							const animals = get_enclosure_animals(req, req.params.id).then((animals) => {
								const enclosures = get_all_enclosures().then((enclosures) =>{              // Get all enclosure objects
						    		animals.items.forEach(function(element){                                 // For each animal
						    			enclosures.forEach(function(widget){                                // For each enclosure
						    				if(widget.id == element.enclosure){                               // If the enclosure ID matched the animal enclosure
						    					element['enclosure'] = {"id": widget.id, 
						    							"number": widget.number, 
						    							"self": widget.self};                               // Replace animal enclosure with enclosure id, number, and self link
						    				}
						    			});
						    		});
						    		res.status(200).json(animals);                                  // Return animal objects as JSON
								});
							});
						}
					}
			    });
			}
		}
	}
});


/**********************************************************************************
 * POST ENCLOSURE validates the body data submitted by the request, confirms the 
 * new enclosure number is unique, the animal_id exists, and the animal_id is not 
 * already in another enclosure; then calls the function to POST the new animal 
 * to the GCP Datastore
 *********************************************************************************/
app.post('/enclosures', checkJwt, function(req, res){   
	if(req.get('accept') !== 'application/json'  && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (!req.body.number || !req.body.type || !req.body.size || 
			isNaN(req.body.number) || !isNaN(req.body.type) || isNaN(req.body.size)){  // Validate body data
			res.status(403).send('Error 403: invalid enclosure data');
		}
		else{
			if(req.user.name == null){                                               // If not user credentials
				res.status(401).send('Error 401 Unauthorized: invalid credentials');   // Send error
			}
			else{
				const enclosures = get_all_enclosures().then((enclosures) => {     // Get all enclosures
					var x = 0;
					for(var i = 0; i < enclosures.length; i++){                     // For each enclosure
						if(enclosures[i]['number'] == req.body.number){               // If the enclosure number matches the body.number
							x++;                                                         // Increment x
						}
					}
					
					if(x > 0){                                                                      // If x has been incremented
						res.status(409).send('Error 409: enclosure number already exists').end();    // The enclosure number is already taken
					}
					else{                                                                              // Else
						post_enclosure(req.body.number, req.body.type, req.body.size, req.user.name)      // Post the enclosure object to the datastore and return the key.id
					    .then( key => {
					    	res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
					    	res.status(201).send('{ "id": ' + key.id + ' }').end()});
					}
				});
			}
		}
	}
});

/**********************************************************************************
 * PUT ENCLOSURE validates the body data submitted by the request, confirms the 
 * enclosure ID is valid and exists, confirms the request is not attempting to 
 * change the enclosure number to another existing enclosure number, confirms 
 * that, if applicable, the animal ID provided is valid and exists, confirms the 
 * animal ID is not listed in another enclosure, confirms the date provided, if 
 * applicable, is a valid format, then, finally calls the function to update the 
 * enclosure's data in the datastore
 *********************************************************************************/
app.put('/enclosures/:id', checkJwt, function(req, res){   
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (!req.body.number || !req.body.type || !req.body.size || isNaN(req.body.number
			|| !isNaN(req.body.type) || isNaN(req.body.size))) {
			res.status(403).send('Error 403 Forbidden: invalid enclosure data');        // Validate enclosure data
		}
		else{
			if (req.params.id.length != 16 || isNaN(req.params.id)) {                      // Validate enclosure ID
				res.status(403).send('Error 403 Forbidden: invalid enclosure ID');
			}
			else{
				if(req.user.name == null){
					res.status(401).send('Error 401 Unauthorized: invalid credentials');
				}
				else{
				    const anEnclosure = get_an_enclosure(req.params.id).then((anEnclosure) => {          // Get enclosure object
				    	if(anEnclosure[0] == null){                                                        // If object is null
				    		res.status(404).send('Error 404 Not found: enclosure ID NOT FOUND').end();         // Enclosure ID does not exist
				    	}
				    	else{
				    		if(anEnclosure[0].owner !== req.user.name){
				    			res.status(401).send('Error 401 Unauthorized: user does not keep this enclosure').end();   // User does not keep this enclosure
				    		}
				    		else{
					    		const enclosures = get_all_enclosures().then((enclosures) => {                         // Get all enclosures
					    			var x = 0;
					    			for(var i = 0; i < enclosures.length; i++){                                          // For each enclosure
					    				if(enclosures[i].number == req.body.number && 
					    				   enclosures[i].id != req.params.id){                                            // If the body.number matches another enclosure's number
					    					x++;                                                                           // Increment x
					    				}
					    			}
					    			
					    			if(x > 0){                                                                               // If x has been incremented
					    				res.status(409).send('Error 409 Conflict: enclosure number already exists').end();     // The enclosure number is already taken
					    			}
					    			else{																				            // Else
						   				put_enclosure(req.params.id, req.body.number, req.body.type, req.body.size, req.user.name)           // Update enclosure with all body data
						   				.then(res.status(303).location('https://kraftme-223903.appspot.com/enclosures/'+req.params.id).end());
						   			}
						   		});
				    		}
					   	}
					});
				}
			}
		}
	}
});

/**********************************************************************************
 * DELETE ENCLOSURE confirms the enclosure ID is valid and exists, then a function 
 * is called to delete the enclosure record from the datastore
 *********************************************************************************/
app.delete('/enclosures/:id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if (req.params.id.length != 16 || isNaN(req.params.id)) {      // Validate ship id
			res.status(403).send('Error 403 Forbidden: invalid enclosure ID');
		}
		else{
			if(req.user.name == null){                                                // If not user credentials
				res.status(401).send('Error 401 Unauthorized: invalid credentials');    // Send error
			}
			else{
				const enclosure = get_an_enclosure(req.params.id)                         // Get the enclosure
			    .then((enclosure) => {
			    	if(enclosure[0] == null){                                               // If enclosure object is null
			    		res.status(404).send('Error 404: enclosure ID NOT FOUND').end();      // Enclosure id does not exist
			    	}
			    	else{                                                                          // Else
			    		if(enclosure[0].owner !== req.user.name){
			    			res.status(401).send('Error 401 Unauthorized: user does not keep this enclosure').end();  // Enclosure does not exist
			    		}
			    		else{
				    		const animals = get_all_animals().then((animals) => {              // Get all animals
				    			animals.forEach(function(element){                               // For each animal object
				    				if(element.enclosure == req.params.id){                         // If the enclosure matches the enclosure id
				    					put_animal(element.id, element.name, 
				    							element.type, element.age, null);                      // Set animal's enclosure to null
				    				}
				    			});
				    		});
				    		delete_enclosure(req.params.id).then(res.status(204).end());      // Call function to delete enclosure object
			    		}
			    	}
			    });
			}
		}
	}
});

/**********************************************************************************
 * PUT ANIMAL IN ENCLOSURE confirms that both the enclosure and animal IDs are 
 * valid and exist, then confirms that the animal is not already in another
 * enclosure. If not, the animal's enclosure is updated to the enclosure ID and
 * the animal ID is added to the enclosures animal array, when appropriate.
 *********************************************************************************/
app.put('/enclosures/:enclosure_id/animals/:animal_id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if(req.user.name == null){                                              // If not user credentials
			res.status(401).send('Error 401 Unauthorized: invalid credentials');  // Send error
		}
		else{
			if (req.params.enclosure_id.length != 16 || isNaN(req.params.enclosure_id)) {   // Validate ship id
				res.status(403).send('Error 403: invalid enclosure ID');
			}
			else{
			    const enclosure = get_an_enclosure(req.params.enclosure_id)              // Get enclosure object by id
				.then( (enclosure) => {
					if(enclosure[0] == null){                                              // If enclosure object is null
						res.status(404).send('Error 404: enclosure ID NOT FOUND').end();     // Enclsure id does not exist
			    	}
					else{
						if(enclosure[0].owner !== req.user.name){                                      // If owner does not match user id_token name
							res.status(401).send('Error 401 Unauthorized: user does not keep this enclosure').end();  // User does not own enclosure
						}
						else{
							if (req.params.animal_id.length != 16 || isNaN(req.params.animal_id)) {     // Validate animal id
								res.status(403).send('Error 403: invalid animal ID');
							}
							else{
							    const animal = get_an_animal(req.params.animal_id)                      // Get the animal by id
								.then( (animal) => {
									if(animal[0] == null){                                                 // If animal object is null
										res.status(404).send('Error 404: animal ID NOT FOUND').end();           // Animal object does not exist
							    	}
									else{
										if(animal[0].enclosure !== req.params.enclosure_id && animal[0].enclosure !== null){                      // If enclosure is not null and does not match animal's enclosure
											res.status(403).send('Error 403 Forbidden: animal is currently assigned to another enclosure').end();   // Animal is assigned to another enclosure
										}
										else{
											put_animal(animal[0].id, animal[0].name, animal[0].species, animal[0].age, req.params.enclosure_id)
											.then(res.status(303).location('https://kraftme-223903.appspot.com/animals/'+req.params.animal_id).end());    // Update animal with enclosure id as enclosure
										}
									}
								});
						    }
						}
					}
			    });
			}
		}
	}
});

/**********************************************************************************
 * REMOVE ANIMAL FROM ENCLOSURE confirms that both the enclosure and animal IDs 
 * are valid and exist, then confirms that the animal ID specified is in fact 
 * residing in the enclosure ID specified. If so, the function to update the 
 * enclosure object is called in order to remove the animal from the enclosures
 * animal array.
 *********************************************************************************/
app.delete('/enclosures/:enclosure_id/animals/:animal_id', checkJwt, function(req, res){  
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		if(req.user.name == null){                                                 // If not user credentials
			res.status(401).send('Error 401 Unauthorized: invalid credentials');     // Send error
		}
		else{
			if (req.params.enclosure_id.length != 16 || isNaN(req.params.enclosure_id)) {  // Validate the enclosure id
				res.status(403).send('Error 403 Forbidden: invalid enclosure ID');
			}
			else{
			    const enclosure = get_an_enclosure(req.params.enclosure_id).then( (enclosure) => {    // Get the enclosure object by id
					if(enclosure[0] == null){                                                           // If the enclosure object is null
						res.status(404).send('Error 404 Not Found: enclosure ID NOT FOUND').end();       // Enclosure does not exist
			    	}
					else{                                                                                           // Else
						if(enclosure[0].owner !== req.user.name){                                                    // If owner deos not match user name
							res.status(401).send('Error 401 Unauthorized: user does not keep this enclosure').end();      // User does not own enclosure
						}
						else{
							if (req.params.animal_id.length != 16 || isNaN(req.params.animal_id)) {            // Validate the animal id
								res.status(403).send('Error 403 Forbidden: invalid animal ID');
							}
							else{
							    const animal = get_an_animal(req.params.animal_id)                                  // Get the animal object by id
								.then( (animal) => {
									if(animal[0] == null){                                                         // If the animal object is null
										res.status(404).send('Error 404 Not Found: animal ID NOT FOUND').end();      // Animal Id does not exist
							    	}
									else{                                                                                // Else
										if(animal[0].enclosure !== req.params.enclosure_id){                                                // If the animal's enclosure doesn't match the enclosure id
											res.status(403).send('Error 403 Forbidden: animal is not currently living in this enclosure');    // We cannot remove this animal from this enclosure
										}
										else{                                                                                        // Else
											put_animal(animal[0].id, animal[0].name, animal[0].species, animal[0].age, null)          // Update the animal's enclosure to be null
											.then(res.status(204).end());
										}
									}
								});
						    }
						}
					}
			    });
			}
		}
	}
});

/*******************************************************************************
 * oauth makes the POST request to recover an access token for the API.
 * This access token is used in the subsequent GET request to recover user info
 * from Google+. Finally, an html page is rendered to display the user info
 * recovered, using the access token granted by the POST request.
 ******************************************************************************/
app.post("/oauth", function(req, res){  
	if(req.get('accept') !== 'application/json' && req.get('accept') !== null){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.');
    }
	else{
		var options = { method: 'POST',									// Post request to get Client Credentials to create users
			  url: 'https://kraftme.auth0.com/oauth/token',
			  headers: { 'content-type': 'application/json' },
			  body: { grant_type: 'client_credentials',
			     client_id: ClientId,
			     client_secret: ClientSecret,
			     audience: 'https://kraftme.auth0.com/api/v2/' },
			  json: true };
	
		request(options, function (error, response, body) {            // Send request
		  if (error) throw new Error(error);
	
		  console.log(body);
		  res.send(body);												// Return access credentials
		});
	}
});

/**********************************************************************************
 * POST USER validates the body data and authorization code submitted by the 
 * request, confirms the new user email is unique, then calls the function to 
 * POST the new user to the Auth0 API
 *********************************************************************************/
app.post('/users', checkJwt, function(req, res) {  
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
		if(req.user.name != null || req.body.username == null ||
				req.body.password == null){
			res.status(400).status("Error 404 Not Found: invalid request parameters");  // Validate request parameters
		}
		else{
		  	var options = { method: 'POST',                               // Post request to create a new user
		    		url: 'https://kraftme.auth0.com/api/v2/users',
		    		headers: { 'content-type': 'application/json',
		    				'Authorization': req.headers.authorization},
		    		body: {
		    			  "connection": "Username-Password-Authentication",
		    			  "email": req.body.username+"@osu-zoo.com",
		    			  "password": req.body.password,
		    			  "email_verified": true,
		    			  "verify_email": false
		    			},
		    		json:true};
			    
			request(options, (error, response, body) => {                // Send request
			    if (response.statusCode != 201){
			        res.status(response.statusCode).send(body);
			    } else {
			    	console.log(body);
			        res.status(201).send(body);                          // Return user object
			    }
			});
		}
	}
});

/**********************************************************************************
 * GET USERS validates the body data and authorization code submitted by the 
 * request, confirms the new user email is unique, then calls the function to 
 * POST the new user to the Auth0 API
 *********************************************************************************/
app.get('/users', checkJwt, function(req, res) {     
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
		if(req.user.name != null){                                                               // If not client credentials
			res.status(403).status("Error 403 Forbidden: a user cannot view all user accounts");   // Send error
		}
		else{
		  	var options = { method: 'GET',                               // Post request to view all users
		    		url: 'https://kraftme.auth0.com/api/v2/users',
		    		headers: { 'content-type': 'application/json',
		    				'Authorization': req.headers.authorization},
		    		json:true};
			    
			request(options, (error, response, body) => {                // Send request
			    if (error){
			        res.status(403).send(error);
			    } else {
			    	console.log(body);
			        res.status(200).send(body);                          // Return user objects
			    }
			});
		}
	}
});

/**********************************************************************************
 * GET USER ID validates the body data and authorization code submitted by the 
 * request, confirms the new user email is unique, then calls the function to 
 * POST the new user to the Auth0 API
 *********************************************************************************/
app.get('/users/:id', checkJwt, function(req, res) {  
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
	  	var options = { method: 'GET',                                          // Post request to get a single 
	    		url: 'https://kraftme.auth0.com/api/v2/users/'+req.params.id,
	    		headers: { 'content-type': 'application/json',
	    				'Authorization': req.headers.authorization},
	    		json:true};
		    
		request(options, function(error, response, body) {                // Send request
		    if (response.statusCode != 200){
		        res.status(response.statusCode).send(body);
		    } else {
		        res.status(200).send(body);                          // Return user object
		    }
		});
	}
});

/**********************************************************************************
 * POST USER validates the body data and authorization code submitted by the 
 * request, confirms the new user email is unique, then calls the function to 
 * POST the new user to the Auth0 API
 *********************************************************************************/
app.delete('/users/:id', checkJwt, function(req, res) {    
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
		if(req.user.name != null){                                                               // If not client credentials
			res.status(403).status("Error 403 Forbidden: a user cannot delete a user account");    // Send error
		}
		else{
		  	var options = { method: 'DELETE',                                        // request to delete existing user
		    		url: 'https://kraftme.auth0.com/api/v2/users/'+req.params.id,
		    		headers: { 'content-type': 'application/json',
		    				'Authorization': req.headers.authorization},
		    		json:true};
			    
			request(options, (error, response, body) => {                // Send request
			    if (response.statusCode == 403){
			        res.status(403).send(body);
			    } else {
			    	console.log(body);
			        res.status(204).send(body);                          // Return 204 status
			    }
			});
		}
	}
});

/**********************************************************************************
 * POST LOGIN validates the body data, then calls the POST function to login the
 * user with their username and password and returns the users OpenID access
 * credentials.
 *********************************************************************************/
app.post('/login', function(req, res){  
	if(req.get('accept') !== 'application/json'){
        res.status(406).send('Error 406 Not Accepted: server only uses application/json.')
    }
	else{
		if(req.body.username == null || req.body.password == null){
			res.status(404).status("Error 404 Not Found: invalid request parameters");
		}
		else{
		    var options = { method: 'POST',                              // Post request to login user
		    		url: 'https://kraftme.auth0.com/oauth/token',
		    		headers: { 'content-type': 'application/json' },
		    		body:
		    		{ scope: 'openid',                                   // OpenID scope to get ID token
		    			grant_type: 'password',
		    			username: req.body.username,
		    			password: req.body.password,
		    			client_id: ClientId,
		    			client_secret: ClientSecret},
		    			json: true };
		    
		    request(options, (error, response, body) => {                // Send request
		        if (error){
		            res.status(500).send(error);
		        } else {
		        	console.log(body);
		            res.send(body);                                      // Return access credentials
		        }
		    });
		}
	}
});

/**********************************************************************************
 * DELETE ANIMALS returns 405 error since this API does not support deleting all 
 * animals at one time
 *********************************************************************************/
app.delete('/animals', function (req, res){  
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/**********************************************************************************
 * PUT ANIMALS returns 405 error since this API does not support updating all 
 * animals at one time
 *********************************************************************************/
app.put('/animals', function (req, res){  
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/**********************************************************************************
 * DELETE ANIMALS returns 405 error since this API does not support deleting all 
 * animals at one time
 *********************************************************************************/
app.delete('/enclosures', function (req, res){  
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/**********************************************************************************
 * PUT ANIMALS returns 405 error since this API does not support updating all 
 * animals at one time
 *********************************************************************************/
app.put('/enclosures', function (req, res){  
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/**********************************************************************************
 * DELETE USER'S ANIMALS returns 405 error since this API does not support deleting 
 * all user's animals at one time
 *********************************************************************************/
app.delete('/users/:id/enclosures', function (req, res){  
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/**********************************************************************************
 * PUT USER'S ANIMALS returns 405 error since this API does not support updating 
 * all of a user's animals at one time
 *********************************************************************************/
app.put('/users/:id/enclosures', function (req, res){ 
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/* ------------- End Controller Functions ------------- */

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Server listening on port ${PORT}...');
});
