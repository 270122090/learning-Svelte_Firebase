// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore} from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnPuf9OohEi3HSmOEhDi2Oy8xUDr8yvdI",
  authDomain: "testing-bc33d.firebaseapp.com",
  projectId: "testing-bc33d",
  storageBucket: "testing-bc33d.appspot.com",
  messagingSenderId: "152954341533",
  appId: "1:152954341533:web:b87e7cfcac83eb327cac74",
  measurementId: "G-ZNC3DMQDR5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


//representing our database
export const db = getFirestore(app);


export default app;