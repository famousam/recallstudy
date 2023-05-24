// https://jackwhiting.co.uk/posts/using-firebase-admin-sdk-with-netlify-lambda-functions/
const express = require("express");
const serverless = require("serverless-http");

// Firestore
var admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(require('./key_amos.json')),
    databaseURL: "https://recallstudy-568af.firebaseio.com",
  });
}
let db = admin.firestore();

// Express App
const app = express();
const router = express.Router();

router.get("/", (req, res) => {
  res.sendStatus(404);
});

router.get("/get_open_list", async function (req, res) {
  try {
    // every time we distribute a list, set all not finished lists to not distributed.
    const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(Date.now() - (10 * 60 * 1000));
    const query = db.collection('applications').where('completed', '!=', true).where('distributeTime', '<', tenMinutesAgo);
    await query.get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          doc.ref.update({
            distributed: false,
            distributeTime: null
          })
        });
      })
      .catch((error) => {
        console.error('Error querying documents:', error);
      });

    // now get all 
    const collectionRef = db.collection('applications');
    // NOTE: After testing, change 'false' in next line to 'true'
    const querySnapshot = await collectionRef.where('distributed', '!=', false).get();

    const documents = [];
    querySnapshot.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();
      documents.push({
        id: documentSnapshot.id,
        data
      });
    })

    // get the first list of all lists
    var chosen_list = documents[0];

    // set this list to distributed and return the chosen_list to client
    const currentTime = admin.firestore.FieldValue.serverTimestamp();
    collectionRef.doc(chosen_list.id).update({
        distributed: true,
        distributeTime: currentTime
      })
      .then(() => {
        res.send(chosen_list);
      })
      .catch((error) => {
        console.error('Error updating document:', error);
      });
  } catch (error) {
    console.log(error);
  }
})

router.post("/send_response", async function (req, res) {
  var INPUT = JSON.parse(req.body);

  try {
    const collectionRef = db.collection('responses');
    const documentRef = collectionRef.doc()

    await documentRef.set(INPUT);

    var docRef = db.collection('applications').doc(INPUT.List_ID);
    await docRef.update({
      completed: true
    });
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
  }
})


app.use("/.netlify/functions/data", router);

module.exports.handler = serverless(app);
