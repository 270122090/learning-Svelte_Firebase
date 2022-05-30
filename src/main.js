import App from './App.svelte';
import {db} from './firebase.js'
import {collection, addDoc,getDocs, setDoc, getDoc,doc, updateDoc, deleteField } from "firebase/firestore"; 

const app = new App({
	target: document.body,
	props: {
		name: 'Nolene'
	}
});

/*adding documents to the database -- Working
try {
  const docRef = addDoc(collection(db, "Database"), {
    first: "Number",
    last: "Four",
  });

  console.log("this is just the basic);
} catch (e) {
  console.error("Error adding document: ", e);
}*/


/*Nested possible to include skills -- working
const frankDocRef = doc(collection(db, "Database"));
setDoc(frankDocRef, {
    name: "Number",
    surname: "Five",
	Skill: { Skill1: "Python", Skill2: "Javascript", Skill3: "Firestore" }, 
});
console.log("this is nested);*/

/* Add a second document with a additional data -- working
try {
  const docRef = addDoc(collection(db, "Database"), {
    first: "Alan",
    middle: "Mathison",
    last: "Turing",
    born: 1912
  });

  console.log("this is adding more info");
} catch (e) {
  console.error("Error adding document: ", e);
}*/

/*delete data

const userref = doc(db, 'Database', 'CkSkBSyoa6uhI18ABAnr');

// Remove the 'capital' field from the document
  updateDoc(userref, {
    middle: deleteField()
});*/



//Read Data

//need to add a listener




export default app;


