// Import the functions from the kits installed in this case Firebase
import { initializeApp } from "firebase/app";
import { getFirestore} from "firebase/firestore";
import {
  getAuth,
}from 'firebase/auth'

// this is provided by Firebase when you start your firestore - copy and paste it in a .js file  named easily identified.
const firebaseConfig = {
  apiKey: "AIzaSyDnPuf9OohEi3HSmOEhDi2Oy8xUDr8yvdI",
  authDomain: "testing-bc33d.firebaseapp.com",
  projectId: "testing-bc33d",
  storageBucket: "testing-bc33d.appspot.com",
  messagingSenderId: "152954341533",
  appId: "1:152954341533:web:b87e7cfcac83eb327cac74",
  measurementId: "G-ZNC3DMQDR5"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);

//initialises teh Authetication in Firebase
export const auth = getAuth()


//Exporting used to make a variable available in other files
//representing our database
export const NHDataBase = getFirestore(app);
export default app;