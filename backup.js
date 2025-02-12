const admin = require("firebase-admin");
const fs = require("fs");

// Initialize Firebase Admin SDK
const serviceAccount = require("./alist-397309-firebase-adminsdk.json"); // Replace with your service key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const COLLECTION_NAME = "Items"; // Replace with your collection name

async function backupCollection() {
  const collectionRef = db.collection(COLLECTION_NAME);
  const snapshot = await collectionRef.get();

  let data = [];
  snapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync(
    `${COLLECTION_NAME}_backup.json`,
    JSON.stringify(data, null, 2)
  );
  console.log(`Backup complete: ${COLLECTION_NAME}_backup.json`);
}

backupCollection();
