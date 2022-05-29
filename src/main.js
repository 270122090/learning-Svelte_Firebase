import App from './App.svelte';
import {db} from './firebase.js'
import { collection, addDoc,getDocs,doc, setDoc, updateDoc } from "firebase/firestore"; 

const app = new App({
	target: document.body,
	props: {
		name: 'Nolene'
	}
});

//adding documents -- Working
try {
  const docRef = addDoc(collection(db, "Database"), {
    first: "Number",
    last: "Four",
  });

  console.log("Document written with ID: ", docRef.id);
} catch (e) {
  console.error("Error adding document: ", e);
}


//Nested possible to include skills
const frankDocRef = doc(collection(db, "Database"));
setDoc(frankDocRef, {
    name: "Number",
    surname: "Five",
	Skill: { Skill1: "Python", Skill2: "Javascript", Skill3: "Firestore" }, 
});

/* To update age and favorite color:
await updateDoc(frankDocRef, {
    "age": 13,
    "favorites.color": "Red"
});*/

/*
//getting data -- error msg with forEach
const querySnapshot = getDocs(collection(db, "users"));
querySnapshot.forEach((doc) => {
  console.log(`${doc.id} => ${doc.data()}`);
});*/


export default app;
