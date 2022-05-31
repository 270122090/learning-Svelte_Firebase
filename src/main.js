import App from './App.svelte';
import {db} from './firebase.js'
import {collection, addDoc,getDocs, setDoc, getDoc,doc, updateDoc, deleteField,query,where, onSnapshot } from "firebase/firestore"; 

const app = new App({
	target: document.body,
	props: {
		name: 'Nolene'
	}
});

//import {query,where} from "firebase/firestore";


//storing all my collections in my database in a variable 
const colRef = collection(db, 'Database')



//looks at the collection colRef and retrieve and console log an array of our documents (not the data) 
getDocs(colRef)
.then((snapshot)=>{
  let user =[]

  //cycle through the snapshot
  snapshot.docs.forEach((doc) => {
    user.push({ ...doc.data(), id:doc.id})
  })
  console.log(user)
}).catch(err => {
  console.log(err.message)
})

// console logging all the  users who's firstname is first
let username = "Number"
const collectionRef = collection(db,"Database")
const userquery = query(collectionRef,where("first","==",username))
onSnapshot(userquery,(data) => {
  console.log(
    data.docs.map((theuser) =>{
      return theuser.data();
    })
  )
})

//callling the data function to use the actual ID of the document




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



//getting data


//need to add a listener

export default app;


